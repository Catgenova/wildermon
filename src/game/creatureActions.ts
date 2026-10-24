import { DARK_SHOT, DARK_SWING, SOUL_GAIN, TAME_HEAD, tryGain } from './learn';
import { ENCHANT_BURN, enchantRoll, enchantWorks, shotRoll } from './enchanting';
import { swingEnchant, type Enchant } from './enchant';
import type { ActionDef, Target } from './actions';
import { perkN } from './creatures';
import { fedOn, tameLearn, tameNeeds, BASE_STATS, BRACE_MOST, BRACE_STEP, bracePoints, BRIDLE_PACE, COLLAR_CUT, fitted, mirrored, mirrorNames, combedBorn, FILE_RARITY_ODDS, POT_MOST, POT_STEP, potPoints, potRoom, type BaseStat, kindDescription, kindName, markOn, sparFloor, sparring, sparSaid, yielded, isShod, SHOE_DAYS, SHOES_PER_MOUNT, TACK, AGES, ageDef, ageOf, attackOf, bloodMul, careWord, PLAYER_ATTACKER, coaxBonus, COAX_STEP, creatureLevel, GRAZE_FILL, forgetCoaxing, isBaitFor, maxHealth, raritySays, SEX_NAMES, SPECIES, STANCE_NAMES, COMPANION_LEASH, MOUNT_STOREY_SAID, workRangeOf, type Creature, type SpeciesDef, type Stance, type GatherKind, takeArms } from './creatures';
import { studBook } from './husbandry';
import { article, capital, percent } from './words';
import { bestTier, LAMP_TIER_ODDS, mirrorTrait, nextTier, pct, rekindle, traitList, traitName, traitOf, traitSays, traitTier, type Rekindled } from './traits';
import type { Game } from './game';
import { BUCKET_LITRES, furnitureCentre, furnitureName, tracesStoreyRefusal, vehicleOf } from './furniture';
import { MILK_PART, MILK_READY, milkedSays, milkLitres, toppedQl, WHEY_BUCKET, WHEY_FEED, wheyFedSays } from './dairy';
import { vesselBecame } from './placeables';
import { crateTheRest, crateToHand, deedJobLine, emptyCrate, letOut, shutIn, teamOut, teamOutRefusal } from './creaturecrate';
import { itemDef, itemName, RARITIES, rarityOf, type Mark } from './items';
import { BANE_BONUS, banes, hitChance, isBow, WEAPON_BY_ID, weaponDamage } from './gear';
import { ARROWS, armsRefusal, beastReach, BLINDSIDE, blowOf, bowReach, critMul, drawClosest, FALL_BACK, FIST, headBlow, headHide, headSide, hideTakes, nockedArrow, KNIFE_BLEED, KNIFE_BLEED_SECS, meleeReach, myCritChance, STAGGER_MAUL, STAGGER_POLE, stanceDealt, swungWith } from './fight';
import { matOfItem } from './materials';
import { takeGear } from './wildgearActions';
import { defaultKey } from './keybinds';

/**
 * What one offering and one blow teach, landed or not.
 *
 * Taming already paid less for a refusal — by a second set of numbers written
 * out beside the first. A swing and a shot paid the same either way, because
 * the gains sat above the roll.
 */
export const TAME_GAIN = 0.7;
/** Soul strength's from an offering: the one gain all its sources pay (`SOUL_GAIN`). */
export const TAME_NERVE = SOUL_GAIN;
export const SWING_FIGHT = 0.3;
export const SWING_ARM = 0.45;
export const SWING_BODY = 0.05;
export const SHOT_FIGHT = 0.2;
export const SHOT_ARCHERY = 0.5;

type CreatureTarget = Extract<Target, { kind: 'creature' }>;
const isCreature = (t: Target): t is CreatureTarget => t.kind === 'creature';
const creatureOf = (g: Game, t: Target): Creature | undefined => (isCreature(t) ? g.creatures.get(t.id) : undefined);

/**
 * The first item in the inventory that a species will eat; a specific one when
 * asked for. An offering to tame one may be any food at all for a Herdsman's
 * Any Offering, as the island's `bait_in_pack` has it; feeding one kept is
 * `feedOf`, below.
 */
function bait(g: Game, c: Creature, uid?: number, any = false) {
  const def = SPECIES[c.species];
  const takes = (id: string): boolean => isBaitFor(def, id) || (any && (itemDef(id).food ?? 0) > 0);
  if (uid !== undefined) {
    const it = g.inventory.get(uid);
    return it && takes(it.id) ? it : undefined;
  }
  return g.inventory.items.find((it) => takes(it.id));
}
/**
 * What a creature you keep is fed: its own diet, or a bucket of whey, which
 * every kind takes. The island's `feed_in_pack`.
 */
export const feedable = (def: SpeciesDef, id: string): boolean => isBaitFor(def, id) || id === WHEY_BUCKET;
/** How much of its hunger a feeding fills: `WHEY_FEED` for a bucket of whey, a meal (`GRAZE_FILL`) for anything else. */
export const feedFill = (id: string): number => (id === WHEY_BUCKET ? WHEY_FEED : GRAZE_FILL);
/** The first thing in the pack a kept creature is fed; a specific one when asked for. */
function feedOf(g: Game, c: Creature, uid?: number) {
  const def = SPECIES[c.species];
  if (uid !== undefined) {
    const it = g.inventory.get(uid);
    return it && feedable(def, it.id) ? it : undefined;
  }
  return g.inventory.items.find((it) => feedable(def, it.id));
}
/** Why a kept creature has nothing to be fed. The island's `creature_refusal` says the same. */
export const feedRefusal = (c: Creature): string => `Eats: ${dietText(c)}, or a bucket of whey.`;

/** An offering to tame one: its own diet, or any food for a Herdsman's Any Offering. */
const offering = (g: Game, c: Creature, uid?: number) => bait(g, c, uid, g.perk('bait:any', 0) > 0);
/** What each offering in a run is worth to the next: more for a Herdsman's Patient Coax. */
export const coaxStep = (g: Game): number => g.perk('coax:step', COAX_STEP);

/** "blueberries, raspberries or potatoes" — everything this one will take. */
export const dietText = (c: Creature): string => {
  // In the order of their names, as the island's `diet_text` says them.
  const names = SPECIES[c.species].diet.map((id) => itemDef(id).name.toLowerCase()).sort();
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
};

/** "a berry or vegetable" for a Snufflet, "a spice or vegetable" for a Sporeling. */
export const baitHint = (c: Creature): string => SPECIES[c.species].baitHint;

/**
 * The odds of winning a wild thing over with one offering, as they stand: its
 * own wariness, how far your taming is past what it asks, whether it is
 * hungry, what a run of offerings has already bought you, your soul, its age,
 * and Love's Gentle Hand if you took it -- and Love's Old Friend, which makes
 * any kind you have tamed before certain, past the ceiling everybody else is
 * held to. The tooltip and the attempt itself read the same number, so what
 * you are told is what you get.
 */
/** The most any one offering is ever worth: patience buys a hard tame rather than guaranteeing it. */
export const TAME_MOST = 0.95;

export function tameChance(g: Game, c: Creature): number {
  const def = SPECIES[c.species];
  if (!def || def.monster) return 0;
  if (g.pathFx('sure', 0) > 0 && g.guide.has(c.species, 'tamed')) return 1;
  const skill = g.skills.get('taming');
  // What its stage asks over its kind's (`tameNeeds`): more taming, and less of a chance at it.
  const needs = tameNeeds(c);
  const raw = needs.chance + (skill - needs.level) / 200 + (c.hunger < 0.5 ? 0.1 : 0) + coaxBonus(c, g.time, coaxStep(g)) + g.soulBonus();
  // A young one easier still for a Herdsman's Young Trust.
  const age = ageOf(c, g.time) === 'young' ? g.perk('tame:young', AGES.young.tame) : ageDef(c, g.time).tame;
  // And every offering so many points likelier for a Herdsman's Soft Hand, over all the rest of it.
  // And a Tamer's Bridle in your pack (`tool_enchant`).
  return Math.max(0, Math.min(TAME_MOST, raw * age * g.pathFx('tame', 1) * (1 + swingEnchant(g.inventory.tool('bridle'), 'tame')) + g.perk('tame:offer', 0)));
}

function nearPlayer(g: Game, c: Creature): boolean {
  return Math.hypot(c.x - g.player.x, c.y - g.player.y) <= 1.9;
}

/** The vehicle this one would be hitched to: the nearest with a yoke free, looked for where it stands. */
/** The vehicle a wildermon would go into the traces of: the nearest to it with a yoke free, or for one in a crate, the nearest to you. */
export function vehicleFor(g: Game, c: Creature) {
  return c.mode === 'stored' ? g.vehicleNear(g.player.x, g.player.y, 5) : g.vehicleNear(c.x, c.y, 5);
}

/**
 * Why one more wildermon cannot be tamed, or null: the first follows you, and
 * every one after that goes into an empty wildermon crate you carry.
 */
export function tameRoomRefusal(g: Game): string | null {
  const with_ = g.creatures.active();
  if (!with_ || emptyCrate(g)) return null;
  return `${with_.name} already follows you. Need an empty wildermon crate.`;
}

/**
 * Where the companion you have goes when a worker is taken off the deed to
 * follow you instead: onto the deed in its place, when the settlement has
 * work for one more once the worker leaves; otherwise into an empty creature
 * crate you carry; otherwise nowhere, and the worker stays where it is.
 */
export function companionSwap(g: Game, taking: Creature): { current: Creature; to: 'deed' | 'crate' } | { current: Creature; refused: string } | null {
  const current = g.creatures.active();
  if (!current || current === taking) return null;
  if (current.ridden) return { current, refused: `Get down off ${current.name} first.` };
  // What the deed counts once the one being taken is off it and this one is on it.
  const freed = taking.mode === 'deed' && taking.post === null ? 1 : 0;
  if (g.deed && g.creatures.workers().length - freed + 1 <= g.workerCap) return { current, to: 'deed' };
  if (emptyCrate(g)) return { current, to: 'crate' };
  return {
    current,
    refused: g.deed
      ? `${current.name} has nowhere to go: ${g.deed.name} full (${g.workerCap} workers at level ${g.deedLevel}), no empty wildermon crate.`
      : `${current.name} has nowhere to go: no settlement, no empty wildermon crate.`,
  };
}

/** What has to be fitted before anything can be ridden. */
export { TACK } from './creatures';
/** How grown a fleece has to be to shear, and what a full one gives: wool, or a bird's feathers (kept in `./limits`, so a kind's words can read them as it loads). */
import { SHEAR_FEATHERS, SHEAR_FROM, SHEAR_WOOL } from './limits';
export { SHEAR_FEATHERS, SHEAR_FROM, SHEAR_WOOL };


/** Harder at something whose mind is on another fight: a companion's, or somebody else's (`BLINDSIDE`). */
const blindside = (c: Creature): number => (c.enemy !== null && c.enemy !== PLAYER_ATTACKER ? BLINDSIDE : 1);

/**
 * What your fighting trade's passives make of a blow you land on it, as
 * `class_dealt` has them on the island (whose spells add their own there): a
 * Berserker's Executioner on a creature far gone and Pain Fuels on a body far
 * gone, and a Pikeman's Monster Hunter, and Reach Discipline on a creature
 * inside your reach and not yet inside its own of you (`beastReach`).
 */
export function classDealt(g: Game, c: Creature): number {
  const def = SPECIES[c.species];
  const health = g.player.stats.health;
  const d = Math.hypot(c.x - g.player.x, c.y - g.player.y);
  return (c.health < maxHealth(c, def) * g.perk('finish:below', 0) ? g.perk('finish:dmg', 1) : 1)
    * (health < g.perk('pain:deep', 0) ? g.perk('pain:deeper', 1) : health < g.perk('pain:below', 0) ? g.perk('pain:dmg', 1) : 1)
    * (def.monster ? g.perk('monster:dmg', 1) : 1)
    * (d <= meleeReach(g) && d > beastReach(def) ? g.perk('gap:dmg', 1) : 1)
    // And harder on a hostile monster for a Sunstrike in what you swing (`enchant_of`).
    * (def.monster ? 1 + swingEnchant(swungWith(g).item, 'smite') : 1);
}

/**
 * What a landed blow does besides its damage, by the kind of weapon it was:
 * a maul knocks a heavy blow off its stroke and staggers it, a spear puts its
 * next blow back, a knife leaves it bleeding. The island does the same in
 * `perform_fight`.
 */
function sideBlow(g: Game, c: Creature, kind: string, dmg: number): void {
  if (kind === 'mauls') {
    if (c.windup > 0) g.logMsg(`Heavy blow broken: ${SPECIES[c.species]?.name.toLowerCase() ?? 'thing'}.`, 'fight');
    c.windup = 0;
    c.cooldown = Math.max(0, c.cooldown) + STAGGER_MAUL;
  } else if (kind === 'polearms') c.cooldown = Math.max(0, c.cooldown) + STAGGER_POLE;
  else if (kind === 'knives') {
    c.bleedRate = Math.max(c.bleedRate, dmg * KNIFE_BLEED);
    // Longer for a Skirmisher's Long Bleed (`side_blow`), and running from now.
    c.bleedFrom = g.time;
    c.bleedUntil = g.time + KNIFE_BLEED_SECS * g.perk('bleed:secs', 1);
  }
}

/**
 * A blow at a share of a swing's from what you hold, on a creature within
 * your reach, as the island's `class_riposte` strikes it: a Skirmisher's
 * Riposte, when a creature's blow at you is dodged.
 */
export function riposte(g: Game, c: Creature, share: number): void {
  if (c.health <= 0 || Math.hypot(c.x - g.player.x, c.y - g.player.y) > meleeReach(g)) return;
  const def = SPECIES[c.species];
  const { def: usable, item } = swungWith(g);
  if (g.rand() > hitChance(g, usable, item) * bloodMul(c, 'evade')) {
    g.logMsg(`Riposte missed: ${def.name.toLowerCase()}.`, 'fight');
    return;
  }
  const bane = banes(item) && def.glow ? BANE_BONUS : 1;
  const crit = g.rand() < myCritChance(g, usable) * markOn(g, c, 'marked');
  const dmg = weaponDamage(g, usable, item) * bane * stanceDealt(g.settings.fightStance, (k, o) => g.perk(k, o))
    * hideTakes(def.hide, blowOf(usable)) * blindside(c) * (0.75 + g.rand() * 0.5) * (crit ? critMul(g, usable) : 1)
    * classDealt(g, c) * share;
  g.creatures.hurt(g, c, dmg, 'player', crit);
  if (c.health > 0 && usable.id !== FIST.id) sideBlow(g, c, usable.kind, dmg);
  if (item) g.damageItem(item, 0.35 * g.perk('worn:weapon', 1));
  g.logMsg(c.health > 0
    ? `Riposte${crit ? ', critical' : ''}: ${def.name.toLowerCase()} ${Math.ceil(c.health)}/${maxHealth(c, def)}.`
    : `Riposte: ${def.name.toLowerCase()} killed.`, 'fight');
}

/**
 * Eight things put back together out of the ground, used on a wildermon of
 * yours from its menu: a bronze mirror marks it, and the young of its next
 * covering get its best trait as it carries it (`mirrored`, `mirrorTrait`); an ancient collar and an ancient bridle are fitted for
 * good (`fitted`, `COLLAR_CUT`, `BRIDLE_PACE`), an ancient brace adds a step of
 * action speed a use (`BRACE_STEP`, `BRACE_MOST`), an ancient comb takes one stage off its age
 * (`combedBorn`), an ancient file makes it a step rarer one time in
 * `FILE_RARITY_ODDS`, an ancient lamp rerolls its lowest-tier trait at that
 * tier, or one time in `LAMP_TIER_ODDS` the tier above (`rekindle`), and an
 * ancient pot puts a point into one of its base stats (`BASE_STATS`,
 * `POT_STEP`, `POT_MOST`). Asked for: "restored artifacts can be used on
 * Wildermon". Each is used up whatever comes of it; one that would do nothing
 * is refused and kept. The island's `artifact_action`, `artifact_refusal` and
 * `perform_artifact`.
 */
export const ARTIFACT_FOR: Readonly<Record<string, string>> = {
  use_bronze_mirror: 'bronze_mirror',
  use_ancient_brace: 'ancient_brace',
  use_ancient_bridle: 'ancient_bridle',
  use_ancient_collar: 'ancient_collar',
  use_ancient_comb: 'ancient_comb',
  use_ancient_file: 'ancient_file',
  use_ancient_lamp: 'ancient_lamp',
  use_ancient_pot: 'ancient_pot',
};
const artifactName = (action: string): string => itemDef(ARTIFACT_FOR[action]).name.toLowerCase();
/** The one in your pack it would use: a locked one is not offered up, as nothing else spends one. */
const artifactIn = (g: Game, action: string) => g.inventory.find(ARTIFACT_FOR[action]);
/** Yours, out of its crate: what an artifact can be used on, and what its menu offers one for. */
const artifactOn = (c: Creature | undefined): boolean => !!c && c.mode !== 'wild' && c.mine !== false;

/** Why an artifact would do nothing for this one, or null. The island's `artifact_refusal` says the same. */
export function artifactRefusal(g: Game, c: Creature | undefined, action: string): string | null {
  if (!c) return 'Gone.';
  if (!artifactOn(c)) return c.mode === 'wild' ? 'Not yours.' : `${c.name}: not yours.`;
  if (c.mode === 'stored') return `${c.name} is in a wildermon crate: open it first.`;
  if (!nearPlayer(g, c)) return `Stand next to ${c.name}.`;
  const name = artifactName(action);
  if (!artifactIn(g, action)) return `Need ${article(name)} ${name}.`;
  if (action === 'use_ancient_comb' && ageOf(c, g.time) === 'young') return `${c.name} is already young.`;
  if (action === 'use_ancient_file' && c.rare >= RARITIES.length - 1) {
    return `${c.name} is already ${RARITIES[RARITIES.length - 1].name}, the top rarity.`;
  }
  if (action === 'use_bronze_mirror' && mirrored(c)) return `${c.name}: already mirrored.`;
  if (action === 'use_bronze_mirror' && !mirrorTrait(c.traits)) return `${c.name}: no traits to copy.`;
  if (action === 'use_ancient_brace' && bracePoints(c) >= BRACE_MOST) return `${c.name}: ${BRACE_MOST} ancient brace uses, the max.`;
  if (action === 'use_ancient_collar' && fitted(c, 'collar')) return `${c.name}: ancient collar already fitted.`;
  if (action === 'use_ancient_bridle' && fitted(c, 'bridle')) return `${c.name}: ancient bridle already fitted.`;
  if (action === 'use_ancient_pot' && !potRoom(c).length) {
    return `${c.name}: every base stat at ${POT_MOST} ancient pot points, the max.`;
  }
  return null;
}

/** What the points from ancient pots in one stat come to, in the game's terms: "3 of 10: the health it can carry is 9% more than ...". */
export const potSays = (stat: BaseStat, points: number): string =>
  `${points}/${POT_MOST} points, ${BASE_STATS.find((s) => s.id === stat)?.says ?? stat} +${percent(POT_STEP * points)}`;

/** A trait as an ancient lamp's line names it: "fleet, a rare trait (+20% speed)". The island's `lamp_kindled`. */
const kindled = (id: string): string => {
  const t = traitOf(id);
  const says = t ? traitSays(t) : '';
  // A fighting trait's grade is in its name already: "fanged (rare)".
  const tier = t?.family ? '' : traitTier(id);
  return `${traitName(id)} (${[tier, says].filter(Boolean).join(', ')})`;
};

/** What an ancient lamp says it did, word for word as the island's `perform_artifact` says it. */
export function lampSays(c: Pick<Creature, 'name'>, name: string, did: Rekindled): string {
  const up = did.up ? `, a rarity above ${did.from}` : '';
  const odds = !did.up && nextTier(did.from) ? ` Rarity-up chance: 1 in ${LAMP_TIER_ODDS}.` : '';
  return did.was
    ? `${capital(name)} used on ${c.name}: ${traitName(did.was)} (${did.from}) replaced by ${kindled(did.now)}${up}.${odds}`
    : `${capital(name)} used on ${c.name}: ${kindled(did.now)} added to an empty slot${up}.${odds}`;
}

function artifactAction(id: string, label: string, verb: string): ActionDef {
  return {
    id,
    label,
    verb,
    stamina: 0.01,
    baseTime: 3,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return artifactOn(c) && g.inventory.has(ARTIFACT_FOR[id]);
    },
    check: (t, g) => artifactRefusal(g, creatureOf(g, t), id),
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (artifactRefusal(g, c, id) || !c) return;
      const used = artifactIn(g, id);
      if (!used || !g.inventory.remove(used.uid, 1)) return;
      const name = artifactName(id);
      if (id === 'use_ancient_comb') {
        const born = combedBorn(c, g.time);
        if (born === null) return;
        const was = ageOf(c, g.time);
        c.born = born;
        g.logMsg(was === 'old'
          ? `${capital(name)} used on ${c.name}: now just grown, full pace and pull.`
          : `${capital(name)} used on ${c.name}: now newborn; cannot be worked, ridden or put in the traces until grown.`,
        'wildermon');
      } else if (id === 'use_ancient_file') {
        // One time in `FILE_RARITY_ODDS`, a step and no more.
        if (g.rand() < 1 / FILE_RARITY_ODDS) {
          c.rare = Math.min(RARITIES.length - 1, c.rare + 1);
          g.logMsg(`${capital(name)} used on ${c.name}: now ${rarityOf(c).name}, blood figures ${pct(rarityOf(c).blood)}.`, 'wildermon');
        } else {
          g.logMsg(`${capital(name)} used on ${c.name}: no change. Rarity-up chance: ${percent(1 / FILE_RARITY_ODDS)}.`, 'wildermon');
        }
      } else if (id === 'use_bronze_mirror') {
        // The mark, used up at its next covering (`Creatures.pair`).
        c.boosts = { ...c.boosts, mirror: 1 };
        const best = mirrorTrait(c.traits);
        g.logMsg(`${capital(name)} used on ${c.name}: ${best ? mirrorNames(best) : 'nothing'} to its next young.`, 'wildermon');
      } else if (id === 'use_ancient_brace') {
        // One more use, `BRACE_STEP` more action speed, up to `BRACE_MOST`.
        const n = bracePoints(c) + 1;
        c.boosts = { ...c.boosts, brace: n };
        g.logMsg(`${capital(name)} used on ${c.name}: action speed +${percent(BRACE_STEP * n)} (${n}/${BRACE_MOST}).`, 'wildermon');
      } else if (id === 'use_ancient_collar' || id === 'use_ancient_bridle') {
        // Fitted once and for good, beside the pot points (`fitted`).
        const collar = id === 'use_ancient_collar';
        c.boosts = { ...c.boosts, [collar ? 'collar' : 'bridle']: 1 };
        g.logMsg(collar
          ? `${capital(name)} fitted on ${c.name}: upkeep −${percent(COLLAR_CUT)}.`
          : `${capital(name)} fitted on ${c.name}: speed ridden and in a team +${percent(BRIDLE_PACE)}.`, 'wildermon');
      } else if (id === 'use_ancient_lamp') {
        // Its lowest-tier trait, or an empty slot, at that tier or one time in `LAMP_TIER_ODDS` the tier above.
        const lit = rekindle(c.traits, g.rand);
        if (lit) c.traits = lit.traits;
        // A trait rekindled, for the journal (the island's `perform_artifact` the same).
        if (lit) g.note('rekindled');
        g.logMsg(lit ? lampSays(c, name, lit.did) : `${capital(name)} used on ${c.name}: nothing kindled.`, 'wildermon');
      } else {
        // A stat not yet at the most it takes, any of them as likely as another.
        const room = potRoom(c);
        const stat = room[Math.floor(g.rand() * room.length)];
        const points = potPoints(c, stat) + 1;
        c.boosts = { ...c.boosts, [stat]: points };
        g.logMsg(`${capital(name)} used on ${c.name}: ${BASE_STATS.find((s) => s.id === stat)?.name.toLowerCase()} ${potSays(stat, points)}.`, 'wildermon');
      }
      g.events.emit('creature');
    },
  };
}

export const CREATURE_ACTIONS: ActionDef[] = [
  {
    id: 'examine_creature',
    label: 'Examine',
    verb: 'examining',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t) => isCreature(t),
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      const def = SPECIES[c.species];
      if (c.mode === 'wild') {
        if (def.monster) {
          g.logMsg(`${def.name}: ${def.description ? `${def.description} ` : ''}Health ${Math.ceil(c.health)}/${maxHealth(c, def)}, blow ${attackOf(c, def).toFixed(0)} damage. Cannot be tamed.`, 'error');
          return;
        }
        const warm = coaxBonus(c, g.time, coaxStep(g));
        const used = warm > 0 ? ` Offerings taken: ${c.coaxed}, next +${(warm * 100).toFixed(0)}% chance.` : '';
        g.logMsg(`Wild ${c.rare ? `${rarityOf(c).name} ` : ''}${def.name.toLowerCase()}: ${def.description ? `${def.description} ` : ''}Eats: ${dietText(c)}.${used}${raritySays(c)}`, 'wildermon');
        return;
      }
      const mood = c.hunger < 0.3 ? 'Hungry.' : c.hunger < 0.6 ? 'Peckish.' : 'Fed.';
      const skills = Object.entries(c.skills).map(([id, v]) => `${id} ${v.toFixed(1)}`).join(', ');
      const range = c.mode === 'deed' && def.gathers ? ` Range: ${workRangeOf(c, def)} tiles from the totem.` : '';
      const desc = kindDescription(c);
      g.logMsg(`${c.name} (${c.rare ? `${rarityOf(c).name} ` : ''}${SEX_NAMES[c.sex]} ${kindName(c).toLowerCase()}, ${g.creatures.describe(c)}): ${desc ? `${desc} ` : ''}Level ${creatureLevel(c)}: ${skills}. Health ${Math.ceil(c.health)}/${maxHealth(c, def)}. Care: ${careWord(c.care)}. Traits: ${traitList(c.traits)}.${raritySays(c)}${range} ${mood} Eats: ${dietText(c)}.${studBook(g, c)}`, 'wildermon');
    },
  },
  {
    id: 'tame',
    label: 'Tame',
    verb: 'taming',
    skill: 'taming',
    stamina: 0.03,
    baseTime: 3.5,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return c?.mode === 'wild' && !SPECIES[c.species]?.monster;
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      const def = SPECIES[c.species];
      if (def.monster) return `${def.name}: cannot be tamed.`;
      const needs = tameNeeds(c).level;
      if (g.skills.get('taming') < needs) return `Need taming ${needs}.`;
      if (!offering(g, c)) return `Need an offering: ${dietText(c)}.`;
      return tameRoomRefusal(g);
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c || c.mode !== 'wild') return;
      const def = SPECIES[c.species];
      if (!nearPlayer(g, c)) {
        g.logMsg(`${def.name} moved out of reach.`, 'wildermon');
        return;
      }
      const food = offering(g, c);
      if (!food) return;
      // The crate may have gone out of the pack since the offering was begun.
      const full = tameRoomRefusal(g);
      if (full) {
        g.logMsg(full, 'error');
        return;
      }
      g.inventory.remove(food.uid, 1);
      const skill = g.skills.get('taming');
      // Something that has not yet learned to mistrust you is far easier won,
      // and so is something that has taken food from this hand all afternoon.
      const chance = tameChance(g, c);
      void skill;
      c.hunger = Math.min(1, c.hunger + 0.25);
      if (g.rand() < chance) {
        // Called what it is at its stage, as the island leaves the name it had in the wild (`kindName`).
        c.name = kindName(c);
        c.enemy = null;
        c.attackedBy = null;
        c.stance = 'defensive';
        const crate = g.creatures.active() ? emptyCrate(g) : undefined;
        if (crate) {
          shutIn(g, c, crate);
          g.logMsg(`Tamed: ${c.name}. In the wildermon crate in your pack.`, 'wildermon');
        } else {
          c.mode = 'active';
          g.logMsg(`Tamed: ${c.name}. Follows you.`, 'wildermon');
        }
        forgetCoaxing(c);
        g.note('tamed');
        g.guideMarkKind(c, 'tamed');
        g.gainSkill('taming', tryGain(true, TAME_GAIN * tameLearn(c)));
        g.gainSkill('soul_strength', tryGain(true, TAME_NERVE));
        g.gainSkill('mind_logic', tryGain(true, TAME_HEAD));
      } else {
        // It refused, but it stayed for the offering, and that is worth
        // something to the next one.
        c.coaxed += 1;
        c.coaxedAt = g.time;
        const won = coaxBonus(c, g.time, coaxStep(g));
        const warming = won > 0 ? ` Next offering +${(won * 100).toFixed(0)}% chance.` : '';
        g.logMsg(`Taming failed.${warming}`, 'wildermon');
        g.gainSkill('taming', tryGain(false, TAME_GAIN * tameLearn(c)));
        g.gainSkill('soul_strength', tryGain(false, TAME_NERVE));
        g.gainSkill('mind_logic', tryGain(false, TAME_HEAD));
        c.state = 'idle';
        c.until = g.time;
      }
    },
  },
  {
    id: 'shear',
    label: 'Shear',
    labelFor: (t, g) => {
      const c = creatureOf(g, t);
      return (c && SPECIES[c.species]?.shearYield) === 'feather' ? 'Pluck' : 'Shear';
    },
    verb: 'shearing',
    skill: 'tailoring',
    tool: 'carving_knife',
    stamina: 0.04,
    baseTime: 6,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && !!SPECIES[c.species]?.fleece && c.mode !== 'wild';
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      if (!SPECIES[c.species]?.fleece) return 'Nothing to shear.';
      if (c.mode === 'wild') return 'Tame it first.';
      if (!g.inventory.has('carving_knife')) return 'Need a carving knife.';
      if (c.fleece < SHEAR_FROM) return `${c.name}: ${SPECIES[c.species].shearYield === 'feather' ? 'feathers' : 'fleece'} under ${percent(SHEAR_FROM)} grown.`;
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c || c.fleece < SHEAR_FROM) return;
      if (!nearPlayer(g, c)) {
        g.logMsg(`${c.name} moved out of reach.`, 'wildermon');
        return;
      }
      // A full fleece is three, a half-grown one is one, and quality follows the fleece.
      const yields = SPECIES[c.species].shearYield ?? 'wool';
      // And more of it for a perk on what comes off (a Tailor's Full Fleece), as the island has it.
      // And its line's own third-stage `wool` (`perkN`).
      const n = Math.max(1, Math.round(c.fleece * (yields === 'wool' ? SHEAR_WOOL : SHEAR_FEATHERS))) + Math.floor(g.perk(`plus:${yields}`, 0)) + perkN(c, 'wool');
      const ql = Math.max(1, Math.min(100, 15 + c.fleece * 45 + g.skills.get('tailoring') * 0.4));
      const wool = g.gather(yields, { count: n, ql });
      c.fleece = 0;
      g.note('sheared');
      g.creatures.learnBy(g, c, 'tended');
      g.gainSkill('tailoring', 0.4);
      g.gainSkill('taming', 0.1);
      g.logMsg(`${yields === 'wool' ? 'Sheared' : 'Plucked'} ${c.name}: ${n} ${itemDef(yields).name.toLowerCase()}, QL ${wool.ql.toFixed(1)}.`, 'wildermon');
    },
  },
  {
    id: 'feed',
    label: 'Feed',
    verb: 'feeding',
    stamina: 0,
    baseTime: 1.5,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && (c.mode === 'active' || c.mode === 'deed');
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      return feedOf(g, c, isCreature(t) ? t.itemUid : undefined) ? null : feedRefusal(c);
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      const food = feedOf(g, c, isCreature(t) ? t.itemUid : undefined);
      if (!food || !nearPlayer(g, c)) return;
      // Read before it is drunk: a bucket of whey becomes the bucket in place.
      const whey = food.id === WHEY_BUCKET;
      const said = whey ? wheyFedSays(c.name) : `Fed ${c.name}: ${itemDef(food.id).name.toLowerCase()}.`;
      const fill = feedFill(food.id);
      // A bucket of whey is drunk out of the bucket, and the bucket is kept.
      if (whey) {
        if (!vesselBecame(g, food, 'bucket')) return;
        // Drunk, it counts as a meal to a worker's upkeep (`UPKEEP_FOR`), as everything it eats does (`fedOn`).
        c.unfed = 0;
      } else {
        // What it eats is worth something to its learning and its care, by its quality (`fedOn`); whey is drunk, not eaten.
        fedOn(c, food.id, food.ql, g.time);
        g.inventory.remove(food.uid, 1);
      }
      c.hunger = Math.min(1, c.hunger + fill);
      g.logMsg(said, 'wildermon');
    },
  },
  {
    id: 'set_stance',
    label: 'Stance',
    verb: 'instructing',
    instant: true,
    hidden: true,
    rangeFor: (g) => g.perk('leash:companion', COMPANION_LEASH),
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => creatureOf(g, t)?.mode === 'active',
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c || !isCreature(t) || !t.stance) return;
      c.stance = t.stance;
      c.enemy = null;
      g.logMsg(`${c.name} stance: ${STANCE_NAMES[t.stance].toLowerCase()}.`, 'wildermon');
    },
  },
  /*
   * Orders to a companion in a fight, given from wherever you stand: it hears
   * you across the field (`range`), as it hears a stance.
   */
  {
    id: 'order_attack',
    label: 'Attack my target',
    verb: 'instructing',
    instant: true,
    hidden: true,
    rangeFor: (g) => g.perk('leash:companion', COMPANION_LEASH),
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => creatureOf(g, t)?.mode === 'active',
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c || c.mode !== 'active') return 'Companions only.';
      const foe = isCreature(t) && typeof t.foe === 'number' ? g.creatures.get(t.foe) : undefined;
      if (!foe || foe.mode !== 'wild' || foe.hitchedTo !== null) return `No target: mark a wild one (${defaultKey('fight_mark')}) or fight it.`;
      // As far as it follows a fight: further for a Beastmaster's Long Leash.
      const leash = g.perk('leash:companion', COMPANION_LEASH);
      if (Math.hypot(foe.x - g.player.x, foe.y - g.player.y) > leash) return `Too far: max ${leash} tiles.`;
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      const foe = isCreature(t) && typeof t.foe === 'number' ? g.creatures.get(t.foe) : undefined;
      if (!c || !foe) return;
      c.enemy = foe.id;
      c.heelUntil = -1e9;
      g.logMsg(`${c.name} attacks: ${SPECIES[foe.species].name.toLowerCase()}.`, 'fight');
    },
  },
  {
    id: 'order_heel',
    label: 'Fall back',
    verb: 'instructing',
    instant: true,
    hidden: true,
    rangeFor: (g) => g.perk('leash:companion', COMPANION_LEASH),
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => creatureOf(g, t)?.mode === 'active',
    check: (t, g) => (creatureOf(g, t)?.mode === 'active' ? null : 'Companions only.'),
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      c.enemy = null;
      c.heelUntil = g.time + FALL_BACK;
      g.logMsg(`${c.name} falls back: no new fights for ${FALL_BACK} seconds.`, 'wildermon');
    },
  },
  {
    id: 'assign_deed',
    label: 'Assign to settlement',
    verb: 'assigning',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && c.hitchedTo === null && !c.ridden && (c.mode === 'active' || c.post !== null);
    },
    check: (t, g) => {
      if (!g.deed) return 'No settlement.';
      const c = creatureOf(g, t);
      // A kind with no task has nothing to do there; a Sparra's is sparring with your guards (`sparTaskSays`).
      if (c && !SPECIES[c.species].gathers && SPECIES[c.species].style !== 'spar') return `${SPECIES[c.species].name}: no task.`;
      // One off a post takes a place as much as one off the road, since a post costs none.
      const working = g.creatures.workers().length;
      if (c && (c.mode !== 'deed' || c.post !== null) && working >= g.workerCap) {
        return `${g.deed.name} full: ${g.workerCap} workers at level ${g.deedLevel}.`;
      }
      // A trade it was asked for by name has to be one of its own.
      const want = t.kind === 'creature' ? t.job : undefined;
      if (c && want) {
        const def = SPECIES[c.species];
        const trades: string[] = def.trades ?? (def.gathers ? [def.gathers] : []);
        if (!trades.includes(want)) return `${def.name}: not one of its tasks.`;
      }
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      const d = g.deed;
      if (!c || !d) return;
      g.clearPost(c);
      // The trade it was set to, remembered only when it is not what its kind
      // does anyway.
      const want = t.kind === 'creature' ? t.job : undefined;
      c.trade = want && want !== SPECIES[c.species].gathers ? (want as GatherKind) : null;
      c.mode = 'deed';
      c.enemy = null;
      c.state = 'idle';
      c.until = g.time;
      g.logMsg(`${c.name} assigned: ${deedJobLine(c)}.`, 'wildermon');
    },
  },
  {
    id: 'take_creature',
    label: 'Take with you',
    verb: 'calling',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && c.hitchedTo === null && !c.ridden && c.mode === 'deed';
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      const swap = companionSwap(g, c);
      return swap && 'refused' in swap ? swap.refused : null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c || c.mode !== 'deed') return;
      const swap = companionSwap(g, c);
      if (swap && 'refused' in swap) return;
      g.clearPost(c);
      const crate = g.deedCrate();
      // Every load of a trip in its arms, not only the last.
      for (const it of takeArms(c)) if (!(crate && g.crateAdd(crate, it))) g.dropOnGround(Math.floor(c.x), Math.floor(c.y), it);
      c.mode = 'active';
      c.enemy = null;
      c.state = 'idle';
      c.until = g.time;
      g.logMsg(`${c.name} follows you.`, 'wildermon');
      // The one that was following you takes its place, on the deed or in a crate.
      if (swap && swap.to === 'deed') {
        const was = swap.current;
        was.mode = 'deed';
        was.trade = null;
        was.enemy = null;
        was.state = 'idle';
        was.until = g.time;
        g.logMsg(`${was.name} assigned in its place: ${deedJobLine(was)}.`, 'wildermon');
      } else if (swap) {
        const into = emptyCrate(g);
        if (into) {
          shutIn(g, swap.current, into);
          g.logMsg(`${swap.current.name}: into the wildermon crate in your pack.`, 'wildermon');
        }
      }
    },
  },
  {
    id: 'attack_creature',
    label: 'Attack',
    verb: 'fighting',
    skill: 'fighting',
    stamina: 0.07,
    baseTime: 2.5,
    repeat: true,
    // Something wild, or a sparring partner of yours (`SPAR_YIELD`).
    applies: (t, g) => creatureOf(g, t)?.mode === 'wild' || sparring(creatureOf(g, t)),
    labelFor: (t, g) => (sparring(creatureOf(g, t)) ? 'Spar' : 'Attack'),
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      if (c.mode !== 'wild' && !sparring(c)) return 'Tame: release it first.';
      if (c.mode !== 'wild' && yielded(c)) return `${c.name} has yielded: wait.`;
      if (Math.hypot(c.x - g.player.x, c.y - g.player.y) > meleeReach(g)) return 'Out of reach.';
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      const def = SPECIES[c.species];
      // A bow is no use swung; bare hands are the fallback either way.
      const { def: usable, item } = swungWith(g);
      const before = c.health;
      // Its blood has a say in whether you connect at all.
      const landed = g.rand() <= hitChance(g, usable, item) * bloodMul(c, 'evade');
      g.gainSkill('fighting', tryGain(landed, SWING_FIGHT));
      g.gainSkill(usable.kind, tryGain(landed, SWING_ARM));
      g.gainSkill('body_strength', tryGain(landed, SWING_BODY));
      // And, if it is dark enough to matter, what it teaches you about noticing.
      g.fought(DARK_SWING);
      let dealt = 0;
      const spar = c.mode !== 'wild';
      if (!landed) {
        g.logMsg(`Missed: ${spar ? c.name : def.name.toLowerCase()}.`, 'fight');
        if (spar) return Math.hypot(c.x - g.player.x, c.y - g.player.y) <= meleeReach(g);
      } else {
        // Silver's old virtue: what carries its own light hates a silver edge.
        const bane = banes(item) && def.glow ? BANE_BONUS : 1;
        /*
         * And harder or softer for the way you stand, for what its hide makes
         * of an edge, a point or a weight, and harder at something whose mind is
         * on another fight (`fight.ts`).
         */
        // And now and then a critical one (`myCritChance`), harder for a Skirmisher's Lethal on a knife (`critMul`).
        const crit = g.rand() < myCritChance(g, usable) * markOn(g, c, 'marked');
        const dmg = weaponDamage(g, usable, item) * bane * stanceDealt(g.settings.fightStance, (k, o) => g.perk(k, o))
          * hideTakes(def.hide, blowOf(usable)) * blindside(c) * (0.75 + g.rand() * 0.5) * (crit ? critMul(g, usable) : 1)
          // And what your fighting trade's passives make of it (`classDealt`).
          * classDealt(g, c);
        if (spar) {
          // Sparring: no lower than it yields at, and nothing else besides. The island's `perform_fight`.
          c.health = Math.max(sparFloor(c), c.health - dmg);
          c.attackedAt = g.time;
          g.creatures.learnBy(g, c, 'spar');
          if (item) g.damageItem(item, 0.35 * g.perk('worn:weapon', 1));
          g.logMsg(sparSaid(c), 'fight');
          return !yielded(c) && Math.hypot(c.x - g.player.x, c.y - g.player.y) <= meleeReach(g);
        }
        g.creatures.hurt(g, c, dmg, 'player', crit);
        dealt = dmg;
        // And what the weapon does besides: a maul staggers, a spear holds it off, a knife opens it up (a fist none of these).
        if (c.health > 0 && usable.id !== FIST.id) sideBlow(g, c, usable.kind, dmg);
        // Less for a Mender's Armour Care, as `perform_fight` has it.
        if (item) g.damageItem(item, 0.35 * g.perk('worn:weapon', 1));
        g.logMsg(
          `Hit${crit ? ', critical' : ''}: ${def.name.toLowerCase()}${before > c.health ? ` ${Math.max(0, Math.ceil(c.health))}/${maxHealth(c, def)}` : ''}.`,
          'fight',
        );
      }
      if (c.health <= 0) return false;
      /*
       * And it fights back, on its own clock rather than yours.
       *
       * It used to answer each swing of yours with a roll -- a swipe in on one
       * in three, every one for the defensive kinds -- so a fight was a single
       * rhythm and it was yours. Now whatever you strike that does not bolt
       * stands and fights (`engage`), and lands its own blows every
       * `blowEvery` seconds while you are in reach of it, whether you are
       * swinging or not.
       */
      g.creatures.engage(g, c);
      /*
       * And what is enchanted into the weapon, on a hit that landed
       * (`enchanting.ts`): now and then a burn, a bleed, a stun or venom, and
       * every time a Leeching's share back or a Tidecaller's put-back blow.
       */
      const e = landed ? enchantRoll(g, item, c) : null;
      if (e && item?.enchant) {
        enchantWorks(g, e, item.enchant.ql, c, dealt, {
          burn: () => g.burn(c, ENCHANT_BURN.each, ENCHANT_BURN.secs),
          bleed: () => sideBlow(g, c, 'knives', dealt),
        });
      }
      // Keep swinging while it is still within reach.
      return Math.hypot(c.x - g.player.x, c.y - g.player.y) <= meleeReach(g);
    },
  },
  {
    id: 'shoot_creature',
    label: 'Shoot',
    verb: 'shooting',
    skill: 'archery',
    range: 13,
    stamina: 0.05,
    baseTime: 2.6,
    repeat: true,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      const held = g.worn('weapon');
      return !!c && c.mode === 'wild' && !!held && isBow(held.id);
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      const arms = armsRefusal(g, 'shoot_creature');
      if (arms) return arms;
      const held = g.worn('weapon');
      const bow = held && WEAPON_BY_ID.get(held.id);
      if (!held || !bow?.ammo) return 'Need a bow in hand.';
      const d = Math.hypot(c.x - g.player.x, c.y - g.player.y);
      if (d > bowReach(g, bow, held)) return `Too far for a ${itemName(held).toLowerCase()}.`;
      if (d < drawClosest(g)) return 'Too close to draw.';
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      const held = g.worn('weapon');
      const bow = held && WEAPON_BY_ID.get(held.id);
      if (!c || !held || !bow?.ammo) return;
      // The arrows asked for, else plain ones, else any (`nockedArrow`).
      const arrow = nockedArrow(g, isCreature(t) ? t.arrow ?? g.settings.nock : g.settings.nock);
      if (!arrow || !g.inventory.remove(arrow.uid, 1)) return;
      const shape = ARROWS[arrow.id];
      const def = SPECIES[c.species];
      const d = Math.hypot(c.x - g.player.x, c.y - g.player.y);
      // Picking a target out of the dark at range is the hardest looking there is.
      g.fought(DARK_SHOT);
      // The far end of a bow's range is a far harder shot than the near end.
      const reach = 1 - (d / bowReach(g, bow, held)) * 0.35;
      const landed = g.rand() <= hitChance(g, bow, held) * reach * bloodMul(c, 'evade');
      g.gainSkill('fighting', tryGain(landed, SHOT_FIGHT));
      g.gainSkill('archery', tryGain(landed, SHOT_ARCHERY));
      if (!landed) {
        g.logMsg(`Arrow missed: ${def.name.toLowerCase()}.`, 'fight');
      } else {
        // The stave throws it; the head is what goes in. Both have a say.
        const head = matOfItem(arrow);
        const bane = head.bane && def.glow ? BANE_BONUS : 1;
        // And more often on one marked for death (`skirmisher_marked_for_death`; the island's `class_marked`).
        const crit = g.rand() < myCritChance(g, bow) * markOn(g, c, 'marked');
        // And what the head is: a blunt crushes, a bodkin goes through a hide (`headBlow`, `headHide`).
        const dmg = weaponDamage(g, bow, held) * head.edge * bane * stanceDealt(g.settings.fightStance, (k, o) => g.perk(k, o))
          * hideTakes(def.hide, headBlow(shape, bow)) * headHide(shape, def.hide) * blindside(c)
          * (0.6 + arrow.ql / 140) * (0.8 + g.rand() * 0.4) * (crit ? critMul(g, bow) : 1) * classDealt(g, c)
          // And harder on one that is not after you, for an Archer's Ambush (`class_ambush`).
          * (c.enemy !== PLAYER_ATTACKER ? g.perk('ambush:dmg', 1) : 1);
        g.creatures.hurt(g, c, dmg, 'player', crit);
        g.damageItem(held, 0.25 * g.perk('worn:weapon', 1));
        // And now and then the arrow back in your pack, for an Archer's Arrow Saver (`class_arrow_saved`).
        const save = g.perk('save:arrow', 0);
        if (save > 0 && g.rand() < save) g.inventory.add(arrow.id, { ql: arrow.ql, extra: arrow.extra, rare: arrow.rare, maker: arrow.maker });
        // A broadhead bleeds it as a knife does, a blunt staggers it as a maul does (`headSide`).
        const side = headSide(shape);
        if (side && c.health > 0) sideBlow(g, c, side, dmg);
        // And what is enchanted into the bow, now and then (`shotRoll`): a Flamearrow's burn, a Frostbite's slow.
        const e = c.health > 0 ? shotRoll(g, held, c) : null;
        if (e && held.enchant) enchantWorks(g, e, held.enchant.ql, c, dmg, { burn: () => g.burn(c, ENCHANT_BURN.each, ENCHANT_BURN.secs), bleed: () => {} });
        g.logMsg(`Arrow hit${crit ? ', critical' : ''}: ${def.name.toLowerCase()} ${Math.max(0, Math.ceil(c.health))}/${maxHealth(c, def)}.`, 'fight');
      }
      if (c.health <= 0) return false;
      // Shot at, it comes for you, as anything struck does.
      g.creatures.engage(g, c);
      return !!nockedArrow(g) && Math.hypot(c.x - g.player.x, c.y - g.player.y) <= bowReach(g, bow, held);
    },
  },
  {
    id: 'rename_creature',
    asks: {
      question: 'New name:',
      fallback: (t, g) => creatureOf(g, t)?.name ?? '',
      max: 24,
    },
    label: 'Rename',
    verb: 'renaming',
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
      const name = ((t as { name?: string }).name ?? '').trim();
      if (!name) return;
      c.name = name.slice(0, 24);
      g.logMsg(`Renamed: ${c.name}.`, 'wildermon');
    },
  },
  {
    id: 'milk_creature',
    label: 'Milk it',
    verb: 'milking',
    skill: 'farming',
    stamina: 0.02,
    baseTime: 6,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && !!SPECIES[c.species].milk && c.sex === 'female' && c.mode !== 'wild' && c.mode !== 'stored';
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      if (!nearPlayer(g, c)) return `Stand next to ${c.name}.`;
      // Less than a bucket a milking goes on into a part bucket of milk, if there is one (`dairy.ts`).
      const part = milkLitres(c.species) < BUCKET_LITRES && g.inventory.has(MILK_PART);
      if (!part && !g.inventory.has('bucket')) return 'Need an empty bucket.';
      if (c.sex !== 'female') return `${c.name} is male.`;
      if (c.fleece < MILK_READY) return `${c.name}: no milk yet.`;
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c || c.fleece < MILK_READY) return;
      // What it has been fed on is what comes out of it.
      const ql = Math.max(1, Math.min(100, 20 + c.fleece * 40 + c.hunger * 30));
      const litres = milkLitres(c.species);
      if (litres < BUCKET_LITRES) {
        // A Gorral: its litres into the part bucket it started, or into an empty one.
        const part = g.inventory.find(MILK_PART);
        const bucket = part ? undefined : g.inventory.find('bucket');
        if (!part && !bucket) return;
        const had = part?.charges ?? 0;
        const now = Math.min(BUCKET_LITRES, had + litres);
        const made = part ? toppedQl(had, part.ql, litres, ql) : ql;
        if (part && now >= BUCKET_LITRES) {
          const full = vesselBecame(g, part, 'milk_bucket');
          if (full) full.ql = made;
        } else if (part) {
          part.charges = now;
          part.ql = made;
          g.inventory.onChange?.();
          g.events.emit('inventory');
        } else if (bucket) {
          g.inventory.remove(bucket.uid, 1);
          g.inventory.add(MILK_PART, { ql: made }).charges = now;
        }
        c.fleece = 0;
        g.note(`milked:${c.species}`);
        g.creatures.learnBy(g, c, 'tended');
        g.gainSkill('farming', 0.3);
        g.logMsg(milkedSays(c.name, now, made), 'wildermon');
        return;
      }
      const bucket = g.inventory.find('bucket');
      if (!bucket) return;
      g.inventory.remove(bucket.uid, 1);
      g.inventory.add('milk_bucket', { ql });
      // A Farmer's Milkmaid fills a second bucket now and then, if there is one.
      const spare = g.rand() < g.perk('more:milk_creature', 0) ? g.inventory.find('bucket') : undefined;
      if (spare) {
        g.inventory.remove(spare.uid, 1);
        g.inventory.add('milk_bucket', { ql });
      }
      c.fleece = 0;
      g.note(`milked:${c.species}`);
      g.creatures.learnBy(g, c, 'tended');
      g.gainSkill('farming', 0.3);
      g.logMsg(milkedSays(c.name, litres, ql, !!spare), 'wildermon');
    },
  },
  // ---- The saddle: tack fitted, and a rider up. ----
  {
    id: 'tack_creature',
    label: 'Saddle and bridle it',
    verb: 'saddling',
    stamina: 0.02,
    baseTime: 4,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && !!SPECIES[c.species].mount && c.mode !== 'wild' && c.mode !== 'stored' && !c.tacked;
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      if (!nearPlayer(g, c)) return `Stand next to ${c.name}.`;
      if (!ageDef(c, g.time).works) return `${c.name} is not grown.`;
      const want = TACK.filter((id) => !g.inventory.has(id));
      if (want.length) return `Need ${want.map((id) => itemDef(id).name.toLowerCase()).join(' and ')}.`;
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      // What each piece carries of its maker's hand goes onto the mount with it (a Tailor's Saddler).
      const marks: Record<string, Mark> = {};
      // And what each is enchanted with (Fleetfoot, Tamer's Bridle).
      const enchants: Record<string, Enchant> = {};
      for (const id of TACK) {
        const it = g.inventory.find(id);
        if (!it) return;
        const { mark, enchant } = it;
        if (!g.inventory.remove(it.uid, 1)) return;
        if (mark && Object.keys(mark).length) marks[id] = mark;
        if (enchant) enchants[id] = enchant;
      }
      c.tacked = true;
      if (Object.keys(marks).length) c.tack = marks;
      else delete c.tack;
      if (Object.keys(enchants).length) c.tackEnchant = enchants;
      else delete c.tackEnchant;
      g.logMsg(`Saddled and bridled: ${c.name}.`, 'wildermon');
    },
  },
  {
    id: 'shoe_creature',
    label: 'Shoe it',
    verb: 'shoeing',
    stamina: 0.03,
    baseTime: 6,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && !!SPECIES[c.species].mount && c.mode !== 'wild' && c.mode !== 'stored' && !isShod(g.time, c);
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      if (!SPECIES[c.species].mount) return 'Mounts only.';
      if (!nearPlayer(g, c)) return `Stand next to ${c.name}.`;
      if (!ageDef(c, g.time).works) return `${c.name} is not grown.`;
      if (g.inventory.count('horseshoe') < SHOES_PER_MOUNT || !g.inventory.has('mallet')) return `Need ${SHOES_PER_MOUNT} horseshoes and a mallet.`;
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      const shoes = g.inventory.find('horseshoe');
      if (!shoes || !g.inventory.remove(shoes.uid, SHOES_PER_MOUNT)) return;
      c.shodAt = g.time;
      g.logMsg(`Shod: ${c.name}, ${SHOE_DAYS} days. Faster on stone, climbs steeper.`, 'wildermon');
    },
  },
  {
    id: 'untack_creature',
    label: 'Take the tack off',
    verb: 'unsaddling',
    stamina: 0.01,
    baseTime: 2,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && c.tacked && !c.ridden && c.mode !== 'stored';
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      return nearPlayer(g, c) ? null : `Stand next to ${c.name}.`;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      c.tacked = false;
      for (const id of TACK) g.inventory.add(id, { ql: 40, ...(c.tack?.[id] ? { mark: c.tack[id] } : {}), ...(c.tackEnchant?.[id] ? { enchant: c.tackEnchant[id] } : {}) });
      delete c.tack;
      delete c.tackEnchant;
      g.logMsg(`Tack removed: ${c.name}.`, 'wildermon');
    },
  },
  {
    id: 'mount_creature',
    label: 'Mount',
    verb: 'mounting',
    stamina: 0.02,
    baseTime: 1.5,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && !!SPECIES[c.species].mount && c.mode !== 'wild' && c.mode !== 'stored' && !c.ridden;
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      if (!c.tacked) return `${c.name}: no saddle and bridle.`;
      if (!ageDef(c, g.time).works) return `${c.name} is not grown.`;
      if (c.hitchedTo !== null) return `${c.name} is in the traces.`;
      // From the ground floor only: nothing unridden stands a storey up (`Game.creatureStorey`).
      if (!nearPlayer(g, c) || g.player.level !== 0) return `Stand next to ${c.name}.`;
      if (g.driving()) return 'Stop driving first.';
      if (g.player.aboard !== null) return 'Step ashore first.';
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c || !g.mount(c)) return;
      g.note('mounted');
      g.logMsg(`Mounted: ${c.name}.`, 'wildermon');
    },
  },
  {
    id: 'dismount_creature',
    label: 'Get down',
    verb: 'dismounting',
    instant: true,
    stamina: 0,
    baseTime: 0,
    // And on any saddled one of yours out and about: reported stuck up on a Thistlekit with no Get down, the island
    // seating the rider while this side never heard so (`ridden`). Getting down off one you are not on does nothing.
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && (c.ridden || (!!c.mine && c.tacked && c.mode !== 'wild' && c.mode !== 'stored'));
    },
    // Not a storey up a wide staircase: nothing unridden stands up there (`Game.creatureStorey`).
    check: (t, g) => {
      const c = creatureOf(g, t);
      return c && g.creatureStorey(c) > 0 ? MOUNT_STOREY_SAID : null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      g.dismount();
      g.logMsg(`Dismounted: ${c.name}.`, 'wildermon');
    },
  },
  // ---- The traces: a wildermon put to a cart or a wagon. ----
  {
    id: 'hitch_creature',
    label: 'Hitch to the traces',
    verb: 'hitching',
    stamina: 0.02,
    baseTime: 2.5,
    // And one in a crate you carry or stand beside, which comes out of it straight into a yoke.
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && c.mode !== 'wild' && (c.mode !== 'stored' || !!crateToHand(g, c)) && c.hitchedTo === null && !c.ridden && !!vehicleFor(g, c);
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      if (c.mode === 'stored' && !crateToHand(g, c)) return `${c.name} is in a wildermon crate: let it out first.`;
      const f = vehicleFor(g, c);
      if (!f) return 'No cart or wagon with an empty yoke here.';
      const storey = tracesStoreyRefusal(f);
      if (storey) return storey;
      const [cx, cy] = furnitureCentre(f);
      if (Math.hypot(cx - g.player.x, cy - g.player.y) > 2.4) return `Stand by the ${furnitureName(f).toLowerCase()}.`;
      if (c.mode !== 'stored' && Math.hypot(c.x - g.player.x, c.y - g.player.y) > 4) return `${c.name} is too far.`;
      if (!ageDef(c, g.time).works) return `${c.name} is not grown.`;
      if (c.hunger < 0.15) return `${c.name} is too hungry: feed it first.`;
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      const f = vehicleFor(g, c);
      // Out of its crate first, as a companion of yours -- one that does not count as following you while it is in the traces.
      const crated = c.mode === 'stored' && !!f && !!crateToHand(g, c);
      if (crated) {
        letOut(g, c);
        c.mode = 'active';
        c.enemy = null;
      }
      if (!f || !g.hitch(c, f)) {
        // Never in silence: whatever stopped it, in the words the island uses.
        g.logMsg(
          c.hitchedTo !== null ? `${c.name} is already in the traces.`
          : c.ridden ? `${c.name} has a rider on it.`
          : 'No cart or wagon with an empty yoke here.',
          'error',
        );
        return;
      }
      const v = vehicleOf(f);
      const filled = (f.team ?? []).length;
      const short = v && filled < v.needs ? ` Needs ${v.needs - filled} more to move.` : '';
      g.note('hitched');
      // A whole team in it, for the journal's cart and wagon (the island's `perform_ride` the same).
      if (v && filled >= v.needs) g.note(`team:${f.kind}`);
      g.logMsg(`Hitched${crated ? ' from the crate' : ''}: ${c.name} to the ${furnitureName(f).toLowerCase()}, ${filled}/${v?.yokes ?? 0} yokes.${short}`, 'wildermon');
    },
  },
  {
    id: 'unhitch_creature',
    label: 'Take out of the traces',
    verb: 'unhitching',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => creatureOf(g, t)?.hitchedTo !== null && creatureOf(g, t) !== undefined,
    check: (t, g) => {
      const c = creatureOf(g, t);
      const f = c && g.vehicleOfCreature(c);
      return (f ? tracesStoreyRefusal(f) : null) ?? (c ? teamOutRefusal(g, [c]) : null);
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c || teamOutRefusal(g, [c])) return;
      const f = g.vehicleOfCreature(c);
      const out = teamOut(g, [c]);
      g.unhitch(c);
      g.logMsg(`Unhitched: ${c.name} from the ${f ? furnitureName(f).toLowerCase() : 'traces'}.${crateTheRest(g, out)}`, 'wildermon');
    },
  },
  {
    id: 'cull_creature',
    /*
     * Asked first, for the same reason releasing is: on an island `perform` is
     * the island's half, and nothing over there can put a question to this
     * browser. Good blood gets the same second look it gets before it is let
     * go, because this is the more final of the two.
     */
    confirms: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return null;
      const tier = bestTier(c.traits);
      return tier === 'supreme' || tier === 'fantastic'
        ? `${c.name} carries ${tier} blood: ${traitList(c.traits)}. Cull anyway? Cannot be undone.`
        : `Cull ${c.name}? Leaves a carcass.`;
    },
    label: 'Cull',
    verb: 'culling',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && c.mode !== 'wild' && c.hitchedTo === null && !c.ridden;
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      if (c.mode === 'wild') return 'Not yours.';
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      // One in a crate is let out of it first: a carcass lies in front of a
      // crate standing on the ground, and at your feet from one you carry.
      if (c.mode === 'stored') letOut(g, c);
      const x = Math.floor(c.x);
      const y = Math.floor(c.y);
      // Whatever it was holding is not buried with it, and its gear comes back to you (`takeGear`).
      for (const it of takeArms(c)) g.dropOnGround(x, y, it);
      takeGear(g, c);
      if (c.pouch) g.dropOnGround(x, y, c.pouch);
      c.pouch = null;
      const name = c.name;
      const what = SPECIES[c.species].name.toLowerCase();
      g.creatures.kill(g, c, 'player', true);
      g.logMsg(`Culled: ${name}. ${capital(what)} carcass left.`, 'fight');
    },
  },
  {
    id: 'release_creature',
    /*
     * Asked before it happens rather than inside `perform`, which on an island
     * is the island's half — so letting a supreme-blooded wildermon go asked
     * nobody anything at all over there.
     */
    confirms: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return null;
      const tier = bestTier(c.traits);
      return tier === 'supreme' || tier === 'fantastic'
        ? `${c.name} carries ${tier} blood: ${traitList(c.traits)}. Release anyway? Cannot be undone.`
        : `Release ${c.name}?`;
    },
    label: 'Release',
    verb: 'releasing',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && c.mode !== 'wild' && c.hitchedTo === null && !c.ridden;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      if (c.mode === 'stored') letOut(g, c);
      for (const it of takeArms(c)) g.dropOnGround(Math.floor(c.x), Math.floor(c.y), it);
      // Its gear comes back to you (`takeGear`).
      takeGear(g, c);
      c.mode = 'wild';
      c.stance = 'passive';
      c.enemy = null;
      const was = c.name;
      c.name = SPECIES[c.species].name;
      g.logMsg(`Released: ${was}.`, 'wildermon');
    },
  },
  artifactAction('use_bronze_mirror', 'Mirror it with the bronze mirror', 'mirroring it'),
  artifactAction('use_ancient_brace', 'Brace it with the ancient brace', 'bracing it'),
  artifactAction('use_ancient_collar', 'Fit the ancient collar', 'fitting the collar'),
  artifactAction('use_ancient_bridle', 'Fit the ancient bridle', 'fitting the bridle'),
  artifactAction('use_ancient_comb', 'Comb it with the ancient comb', 'combing it'),
  artifactAction('use_ancient_file', 'Go over it with the ancient file', 'going over it'),
  artifactAction('use_ancient_lamp', 'Rekindle a trait with the ancient lamp', 'lighting the lamp'),
  artifactAction('use_ancient_pot', 'Use the ancient pot on it', 'using the pot'),
];

export const CREATURE_ACTION_BY_ID = new Map(CREATURE_ACTIONS.map((a) => [a.id, a]));
export type { Stance };
