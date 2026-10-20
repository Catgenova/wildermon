/**
 * Blood.
 *
 * Every wildermon is born with three **traits**, and they are the difference
 * between one Roxxen and the next. A trait sits in one of four tiers — the
 * same four words the smiths use of a rare hatchet — and what it is worth
 * climbs steeply with the tier: a common trait is a few percent, a fantastic
 * one is half again or better.
 *
 * Traits are not found, they are bred. What is walking about in the wild is
 * almost all common, and the only way to put a fantastic trait into a herd is
 * to breed for it, generation after generation, with animal husbandry behind
 * you and a brush in your hand.
 *
 * Thirty of them are **fighting blood** (`FIGHTING`): one name in all four
 * tiers, so a fanged animal may be fanged, fanged (rare), fanged (supreme) or
 * fanged (fantastic), and which of those it is born with is a roll of its
 * own, off the same odds as the rest.
 */

export type TraitTier = 'common' | 'rare' | 'supreme' | 'fantastic';

/**
 * What a trait can lift. Everything here is a multiplier with one as neutral,
 * `appetite` included — below one there is thrift in it.
 */
export type TraitChannel =
  /** How fast it moves: on its own feet, under a rider, in the traces. */
  | 'speed'
  /** How quickly it gets a task done. */
  | 'work'
  /** How fast what it does goes into it as skill. */
  | 'learn'
  /** Panniers on its back and its share of a team's pull. */
  | 'haul'
  /** What it brings back from a trip out. */
  | 'yield'
  /** How fast the belly empties; below one is a cheap keep. */
  | 'appetite'
  /** How much it can take. */
  | 'hardy'
  /** What its attack lands for. */
  | 'tough'
  /** How far it sees for you. */
  | 'sight'
  /** How far from the token or the post it will work. */
  | 'range'
  /** How fast fleece grows back and milk comes in. */
  | 'grow'
  /** What a blow costs it once it lands; below one is armour. */
  | 'soak'
  /** How often a swing at it lands; below one is hard to hit. */
  | 'evade'
  /** How quickly its blows come. */
  | 'haste'
  /** How fast its wounds close. */
  | 'mend';

export interface TraitDef {
  id: string;
  name: string;
  tier: TraitTier;
  /** What it lifts, and by how much. */
  effects: Partial<Record<TraitChannel, number>>;
  /**
   * A communal trait. What it lifts, it lifts for every wildermon working the
   * same settlement or the same post — the bearer included. One lead beast
   * makes a whole deed quicker.
   */
  aura?: boolean;
  /**
   * The fighting trait this is one grade of. Fighting blood comes in all four
   * tiers of the one name, and which grade an animal gets is its own roll.
   */
  family?: string;
}

export const TIERS: TraitTier[] = ['common', 'rare', 'supreme', 'fantastic'];
/** What each tier is called on a card, and the colour it is written in. */
export const TIER_COLOUR: Record<TraitTier, string> = {
  common: '#9fb0a4',
  rare: '#8fc8f0',
  supreme: '#c79bf0',
  fantastic: '#f0c060',
};

/**
 * The same colours for the page, as tokens the interface's look sets
 * (`--rarity-*` in src/style.css) with the colours above as the fallback that
 * Classic uses: pale blue writing on Runecut's pale stone cannot be read.
 * `TIER_COLOUR` itself stays plain hex for what is not the game's page, such
 * as the wildermon sheet.
 */
export const TIER_CSS = Object.fromEntries(TIERS.map((t) => [t, `var(--rarity-${t}, ${TIER_COLOUR[t]})`])) as Record<TraitTier, string>;

const PLAIN_TRAITS: TraitDef[] = [
  // ---- Common: a few percent apiece, and most of what the wild holds. ----
  { id: 'light_footed', name: 'light-footed', tier: 'common', effects: { speed: 1.08 } },
  { id: 'willing', name: 'willing', tier: 'common', effects: { work: 1.08 } },
  { id: 'curious', name: 'curious', tier: 'common', effects: { learn: 1.12 } },
  { id: 'broad_backed', name: 'broad-backed', tier: 'common', effects: { haul: 1.12 } },
  { id: 'thrifty', name: 'thrifty', tier: 'common', effects: { appetite: 0.92 } },
  { id: 'thick_coated', name: 'thick-coated', tier: 'common', effects: { hardy: 1.12 } },
  { id: 'keen_nosed', name: 'keen-nosed', tier: 'common', effects: { sight: 1.18 } },
  { id: 'biddable', name: 'biddable', tier: 'common', effects: { work: 1.03 }, aura: true },
  { id: 'careful', name: 'careful', tier: 'common', effects: { yield: 1.07 } },
  { id: 'rangy', name: 'rangy', tier: 'common', effects: { range: 1.12 } },
  { id: 'milky', name: 'milky', tier: 'common', effects: { grow: 1.25 } },
  { id: 'scrappy', name: 'scrappy', tier: 'common', effects: { tough: 1.12 } },

  // ---- Rare: worth a fifth to a third, and worth breeding towards. ----
  { id: 'fleet', name: 'fleet', tier: 'rare', effects: { speed: 1.2 } },
  { id: 'diligent', name: 'diligent', tier: 'rare', effects: { work: 1.2 } },
  { id: 'bright', name: 'bright', tier: 'rare', effects: { learn: 1.32 } },
  { id: 'draught_bred', name: 'draught-bred', tier: 'rare', effects: { haul: 1.32 } },
  { id: 'frugal', name: 'frugal', tier: 'rare', effects: { appetite: 0.8 } },
  { id: 'deep_chested', name: 'deep-chested', tier: 'rare', effects: { hardy: 1.32, speed: 1.05 } },
  { id: 'herd_minded', name: 'herd-minded', tier: 'rare', effects: { work: 1.08, learn: 1.08 }, aura: true },
  { id: 'far_ranging', name: 'far-ranging', tier: 'rare', effects: { range: 1.32, sight: 1.2 } },

  // ---- Supreme: a third to a half, and rarely caught rather than bred. ----
  { id: 'swift', name: 'swift', tier: 'supreme', effects: { speed: 1.4 } },
  { id: 'tireless', name: 'tireless', tier: 'supreme', effects: { work: 1.4, appetite: 0.9 } },
  { id: 'quick_witted', name: 'quick-witted', tier: 'supreme', effects: { learn: 1.6 } },
  { id: 'lead_beast', name: 'lead wildermon', tier: 'supreme', effects: { work: 1.16 }, aura: true },
  { id: 'strong_shouldered', name: 'strong-shouldered', tier: 'supreme', effects: { haul: 1.6, tough: 1.2 } },
  { id: 'fine_fleeced', name: 'fine-fleeced', tier: 'supreme', effects: { grow: 1.9, yield: 1.2 } },

  // ---- Fantastic: half again and better. A herd may hold one. ----
  { id: 'windborn', name: 'windborn', tier: 'fantastic', effects: { speed: 1.65, range: 1.2 } },
  { id: 'unflagging', name: 'unflagging', tier: 'fantastic', effects: { work: 1.65, appetite: 0.85 } },
  { id: 'old_blood', name: 'old blood', tier: 'fantastic', effects: { learn: 2, yield: 1.2 } },
  { id: 'pack_leader', name: 'pack leader', tier: 'fantastic', effects: { work: 1.25, learn: 1.25, speed: 1.1 }, aura: true },
  { id: 'ironsides', name: 'ironsides', tier: 'fantastic', effects: { hardy: 2, tough: 1.6 } },
];

// ---- Fighting blood ----

/**
 * Thirty traits for a fight, each in all four tiers.
 *
 * Asked for: "add 30 combat traits that can roll on wildermon, each with its
 * own rarity roll as well". A plain trait *is* its tier — scrappy is common
 * and ironsides fantastic — so the tier roll and the trait roll are one
 * roll. Fighting blood is a name and a grade: the roll picks the name, and
 * then rolls the grade for it off the same wild odds, lifted by husbandry
 * like the rest. What it is worth climbs with the grade by `GRADE_STEP`, so
 * a fanged animal hits for a tenth more and a fanged (fantastic) one for
 * seven tenths more, the same steep climb the plain tiers keep.
 *
 * Every one of them goes into `TRAITS` as four rows, one a tier, so a card,
 * a roll, a breeding and the island's tables read them like any other
 * trait; `family` on the row is the name they share, and an animal never
 * carries two grades of one name.
 */
export interface FightingTraitDef {
  id: string;
  name: string;
  /** What it lifts at the common grade, as a share: 0.1 is a tenth. */
  gains: Partial<Record<TraitChannel, number>>;
  aura?: boolean;
}

export const FIGHTING: FightingTraitDef[] = [
  // What its blows land for.
  { id: 'fanged', name: 'fanged', gains: { tough: 0.1 } },
  { id: 'heavy_pawed', name: 'heavy-pawed', gains: { tough: 0.12 } },
  { id: 'hook_clawed', name: 'hook-clawed', gains: { tough: 0.09 } },
  { id: 'hard_biting', name: 'hard-biting', gains: { tough: 0.11 } },
  { id: 'horned', name: 'horned', gains: { tough: 0.08, hardy: 0.03 } },
  // How much it can take.
  { id: 'thick_hided', name: 'thick-hided', gains: { hardy: 0.1 } },
  { id: 'big_boned', name: 'big-boned', gains: { hardy: 0.12 } },
  { id: 'broad_chested', name: 'broad-chested', gains: { hardy: 0.09, mend: 0.03 } },
  { id: 'stout', name: 'stout', gains: { hardy: 0.11 } },
  { id: 'long_lived', name: 'long-lived', gains: { hardy: 0.08, mend: 0.05 } },
  // What a blow costs it.
  { id: 'tough_skinned', name: 'tough-skinned', gains: { soak: 0.1 } },
  { id: 'plated', name: 'plated', gains: { soak: 0.12 } },
  { id: 'scarred', name: 'scarred', gains: { soak: 0.08, tough: 0.03 } },
  { id: 'bristled', name: 'bristled', gains: { soak: 0.09 } },
  { id: 'stone_backed', name: 'stone-backed', gains: { soak: 0.11 } },
  // How often a swing at it lands.
  { id: 'slippery', name: 'slippery', gains: { evade: 0.1 } },
  { id: 'wary', name: 'wary', gains: { evade: 0.11 } },
  { id: 'nimble', name: 'nimble', gains: { evade: 0.08, speed: 0.03 } },
  { id: 'low_slung', name: 'low-slung', gains: { evade: 0.1 } },
  { id: 'sharp_eyed', name: 'sharp-eyed', gains: { evade: 0.09 } },
  // How quickly its blows come.
  { id: 'quick_jawed', name: 'quick-jawed', gains: { haste: 0.1 } },
  { id: 'snappish', name: 'snappish', gains: { haste: 0.11 } },
  { id: 'twitchy', name: 'twitchy', gains: { haste: 0.08, evade: 0.03 } },
  { id: 'sudden', name: 'sudden', gains: { haste: 0.1 } },
  { id: 'wild_eyed', name: 'wild-eyed', gains: { haste: 0.09, tough: 0.03 } },
  // How fast its wounds close.
  { id: 'quick_healing', name: 'quick-healing', gains: { mend: 0.12 } },
  { id: 'clean_blooded', name: 'clean-blooded', gains: { mend: 0.1 } },
  { id: 'hard_to_kill', name: 'hard to kill', gains: { mend: 0.08, hardy: 0.04 } },
  // And two that fight for the herd.
  { id: 'war_leader', name: 'war leader', gains: { tough: 0.04, haste: 0.02 }, aura: true },
  { id: 'shield_wall', name: 'shield wall', gains: { soak: 0.04 }, aura: true },
];

/** What each grade multiplies the common gain by: the same steep climb the plain tiers keep. */
export const GRADE_STEP: Record<TraitTier, number> = { common: 1, rare: 2.5, supreme: 4.5, fantastic: 7 };
/** The channels where less is better. `CHANNELS` says the same of each, and the blood test checks they agree. */
export const DOWN_CHANNELS = new Set<TraitChannel>(['appetite', 'soak', 'evade']);
/** The row id of one grade of a name: the plain name for common, and the tier hung on it above that. */
export const gradeId = (family: string, tier: TraitTier): string => tier === 'common' ? family : `${family}_${tier}`;
/** What a gain is worth at a grade: a tenth more, or on a channel where less is better, a tenth less of it. */
export function gradeMul(channel: TraitChannel, gain: number, tier: TraitTier): number {
  const g = gain * GRADE_STEP[tier];
  return Math.round((DOWN_CHANNELS.has(channel) ? 1 / (1 + g) : 1 + g) * 1000) / 1000;
}
export const FIGHTING_TRAITS: TraitDef[] = FIGHTING.flatMap((f) => TIERS.map((tier): TraitDef => {
  const effects: Partial<Record<TraitChannel, number>> = {};
  for (const [ch, g] of Object.entries(f.gains)) effects[ch as TraitChannel] = gradeMul(ch as TraitChannel, g as number, tier);
  return { id: gradeId(f.id, tier), name: tier === 'common' ? f.name : `${f.name} (${tier})`, tier, family: f.id, aura: f.aura, effects };
}));
/** The share of what the wild throws up, per slot, that is fighting blood. */
export const FIGHT_SHARE = 0.3;

export const TRAITS: TraitDef[] = [...PLAIN_TRAITS, ...FIGHTING_TRAITS];

export const TRAIT_BY_ID = new Map(TRAITS.map((t) => [t.id, t]));
export const traitOf = (id: string): TraitDef | undefined => TRAIT_BY_ID.get(id);
/** The plain traits by tier: what a roll that is not fighting blood draws from, and what a plain trait climbs into. */
export const BY_TIER: Record<TraitTier, TraitDef[]> = {
  common: PLAIN_TRAITS.filter((t) => t.tier === 'common'),
  rare: PLAIN_TRAITS.filter((t) => t.tier === 'rare'),
  supreme: PLAIN_TRAITS.filter((t) => t.tier === 'supreme'),
  fantastic: PLAIN_TRAITS.filter((t) => t.tier === 'fantastic'),
};

/** Traits every wildermon carries. */
export const TRAIT_SLOTS = 3;

/**
 * What the wild throws up, per slot. Almost all common: a fantastic trait on
 * something you caught is about one animal in seventy, and a fantastic trait
 * you can rely on is one you bred.
 */
export const WILD_ODDS: Record<TraitTier, number> = { common: 0.86, rare: 0.11, supreme: 0.025, fantastic: 0.005 };

const pick = <T,>(list: T[], rand: () => number): T => list[Math.floor(rand() * list.length)];

/** Roll a tier from a table of weights. */
function rollTier(odds: Record<TraitTier, number>, rand: () => number): TraitTier {
  let r = rand() * TIERS.reduce((n, t) => n + odds[t], 0);
  for (const t of TIERS) {
    r -= odds[t];
    if (r < 0) return t;
  }
  return 'common';
}

/** The name a row answers to in a roll: a fighting trait's family, or the plain trait itself. */
export const familyOf = (id: string): string => TRAIT_BY_ID.get(id)?.family ?? id;
/** Whether a set already carries a name, in any grade. */
const holds = (taken: string[], id: string): boolean => taken.some((t) => familyOf(t) === familyOf(id));

/**
 * What a hundred husbandry does to each row of the wild table: a third off the
 * common one, and the three worth having lifted steeply.
 */
export const HUSBANDRY_LIFT: Record<TraitTier, number> = { common: -0.35, rare: 1.5, supreme: 3, fantastic: 5 };
/**
 * The table a keeper of this much husbandry rolls against. Skill of nought is
 * `WILD_ODDS` itself. A wildermon that came into the world rare rolls its own
 * blood on the table lifted as far again for each step of its rarity -- a
 * rare one as if a hundred husbandry stood behind it, a fantastic one three
 * hundred -- and a row lifted below nothing is not rolled at all: a fantastic
 * one has no common blood in it.
 */
export function husbandryOdds(husbandry = 0, rare = 0): Record<TraitTier, number> {
  const lift = Math.max(0, Math.min(100, husbandry)) / 100 + Math.max(0, rare);
  const odds = {} as Record<TraitTier, number>;
  for (const t of TIERS) odds[t] = WILD_ODDS[t] * Math.max(0, 1 + lift * HUSBANDRY_LIFT[t]);
  return odds;
}

/** How much of what is rolled on a table comes out better than common: 14% of the wild table. */
export const betterThanCommon = (odds: Record<TraitTier, number>): number =>
  1 - odds.common / TIERS.reduce((n, t) => n + odds[t], 0);

/**
 * One fresh trait out of the wild, avoiding what is already there. Husbandry
 * tilts the table: a keeper who knows what they are looking at finds better
 * blood in the wild as well as breeding it; and so does a rare wildermon's own
 * rarity (`husbandryOdds`). A share of what comes up is fighting blood, and
 * that is two rolls: the name, and then its own grade.
 */
export function rollTrait(rand: () => number, taken: string[] = [], husbandry = 0, rare = 0): string | null {
  const odds = husbandryOdds(husbandry, rare);
  for (let i = 0; i < 12; i++) {
    const id = rand() < FIGHT_SHARE
      ? gradeId(pick(FIGHTING, rand).id, rollTier(odds, rand))
      : pick(BY_TIER[rollTier(odds, rand)], rand).id;
    if (!holds(taken, id)) return id;
  }
  const rest = TRAITS.filter((t) => !holds(taken, t.id));
  return rest.length ? pick(rest, rand).id : null;
}

/** Three traits for something born in the wild, as rare as it came (a step, nought to three). */
export function rollTraits(rand: () => number, husbandry = 0, rare = 0): string[] {
  const out: string[] = [];
  for (let i = 0; i < TRAIT_SLOTS; i++) {
    const id = rollTrait(rand, out, husbandry, rare);
    if (id) out.push(id);
  }
  return out;
}

// ---- What it is all worth ----

/** One creature's own traits multiplied together on a channel. */
export function traitMul(traits: string[] | undefined, channel: TraitChannel): number {
  let m = 1;
  for (const id of traits ?? []) {
    const t = TRAIT_BY_ID.get(id);
    const v = t?.effects[channel];
    if (v !== undefined) m *= v;
  }
  return m;
}

/** The communal part alone: what one creature's aura traits give everyone. */
export function auraMul(traits: string[] | undefined, channel: TraitChannel): number {
  let m = 1;
  for (const id of traits ?? []) {
    const t = TRAIT_BY_ID.get(id);
    if (!t?.aura) continue;
    const v = t.effects[channel];
    if (v !== undefined) m *= v;
  }
  return m;
}

/** Whether a set of traits carries anything communal at all. */
export const hasAura = (traits: string[] | undefined): boolean => (traits ?? []).some((id) => TRAIT_BY_ID.get(id)?.aura);


// ---- What a channel is, in the words a card uses ----

/**
 * The fifteen things a trait can lift, written out.
 *
 * Every one of these was already declared on `TraitChannel` with a line of
 * comment above it, and a comment is not something a card can print. Reported
 * from the island: *"wildermon traits are useless flair text"* — and they read
 * as flair because the only thing shown was the name and the note. The numbers
 * were sitting in `effects` the whole time and nothing ever put them on a
 * screen.
 *
 * `up` is which way is better, which is the whole of why `appetite` needs a
 * row of its own: it is the one channel where a trait below one is the good
 * one, and a card that prints "−20%" in the colour it prints "−20% speed" in
 * has told you the opposite of what happened.
 */
export interface ChannelDef {
  id: TraitChannel;
  /** What a card calls it. */
  label: string;
  /** What it actually decides. */
  note: string;
  /** Whether more of it is better. False for appetite, and for the two fighting channels where less is better: what a blow costs and how often one lands. */
  up: boolean;
}

export const CHANNELS: ChannelDef[] = [
  { id: 'speed', label: 'speed', up: true, note: 'pace on foot, under a rider and in the traces' },
  { id: 'work', label: 'work', up: true, note: 'settlement task speed' },
  { id: 'learn', label: 'learning', up: true, note: 'skill gained from its work' },
  { id: 'haul', label: 'hauling', up: true, note: 'pannier capacity and its pull in a team' },
  { id: 'yield', label: 'yield', up: true, note: 'output per trip' },
  { id: 'appetite', label: 'upkeep', up: false, note: 'hunger rate' },
  { id: 'hardy', label: 'health', up: true, note: 'max health' },
  { id: 'tough', label: 'damage', up: true, note: 'blow damage' },
  { id: 'sight', label: 'sight', up: true, note: 'sight range for you' },
  { id: 'range', label: 'range', up: true, note: 'work range from the totem or post' },
  { id: 'grow', label: 'regrowth', up: true, note: 'fleece regrowth and milk' },
  { id: 'soak', label: 'damage taken', up: false, note: 'damage taken per landed blow' },
  { id: 'evade', label: 'chance to be hit', up: false, note: 'chance a swing at it lands' },
  { id: 'haste', label: 'speed of blows', up: true, note: 'blow rate' },
  { id: 'mend', label: 'healing', up: true, note: 'wound healing rate' },
];

export const CHANNEL_BY_ID = new Map(CHANNELS.map((c) => [c.id, c]));
export const channelOf = (id: TraitChannel): ChannelDef | undefined => CHANNEL_BY_ID.get(id);

/**
 * A multiplier as a card prints it: `1.32` is `+32%`, `0.8` is `-20%`.
 *
 * Rounded to whole percent, because the figures are all two decimal places and
 * `+31.999999999999996%` is what floating point does to `1.32`.
 */
export function pct(mul: number): string {
  const n = Math.round((mul - 1) * 100);
  return `${n >= 0 ? '+' : '−'}${Math.abs(n)}%`;
}

/** Whether a figure on a channel is a gain, for the colour a card gives it. */
export const isGain = (channel: TraitChannel, mul: number): boolean =>
  (CHANNEL_BY_ID.get(channel)?.up ?? true) ? mul > 1 : mul < 1;

/** "+32% learning", or "+32% learning, +20% yield" for a trait that does two things. */
export function traitSays(t: TraitDef): string {
  return CHANNELS.filter((ch) => t.effects[ch.id] !== undefined)
    .map((ch) => `${pct(t.effects[ch.id] as number)} ${ch.label}`)
    .join(', ');
}

/** Every channel a set of traits touches at all, in the order a card reads them. */
export const channelsOf = (traits: string[] | undefined): ChannelDef[] =>
  CHANNELS.filter((ch) => traitMul(traits, ch.id) !== 1);

/** A trait written out for a log line or a card. */
export const traitName = (id: string): string => TRAIT_BY_ID.get(id)?.name ?? id;
export const traitTier = (id: string): TraitTier => TRAIT_BY_ID.get(id)?.tier ?? 'common';
/** "light-footed, fleet and quick-witted" */
export function traitList(traits: string[]): string {
  const names = traits.map(traitName);
  if (!names.length) return 'none';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The best tier in a set, for sorting a herd by its blood. */
export function bestTier(traits: string[] | undefined): TraitTier {
  let best: TraitTier = 'common';
  for (const id of traits ?? []) {
    const t = traitTier(id);
    if (TIERS.indexOf(t) > TIERS.indexOf(best)) best = t;
  }
  return best;
}

// ---- Breeding ----

/**
 * How much of the sire and dam comes through, by the keeper's hand.
 *
 * At no husbandry half of a foal is its parents and half is whatever the blood
 * throws up; at a hundred, with a well-brushed pair, it is nearly all theirs.
 */
export const inheritChance = (husbandry: number, care: number): number =>
  Math.min(0.96, 0.5 + (Math.max(0, Math.min(100, husbandry)) / 100) * 0.35 + Math.max(0, Math.min(1, care)) * 0.11);

/**
 * The chance that a trait comes through one tier better than it went in. This
 * is the whole of why husbandry is worth having: commons become rares,
 * rares become supremes, and a line that is worked at climbs.
 */
export const upgradeChance = (husbandry: number, care: number): number =>
  (Math.max(0, Math.min(100, husbandry)) / 100) * 0.22 + Math.max(0, Math.min(1, care)) * 0.08;

/** One tier up, or null at the top. */
export const nextTier = (t: TraitTier): TraitTier | null => TIERS[TIERS.indexOf(t) + 1] ?? null;

/**
 * One young in this many is born with a mutation: a trait neither parent
 * carries by name, a tier above the best of theirs (`mutationTier`), in its
 * lowest slot. The island's `mutation_odds`.
 */
export const MUTATION_ODDS = 200;

/**
 * Where one of a young one's traits came from, settled at the covering and
 * kept for good as its pedigree. The island stores the same six words.
 */
export type TraitSource = 'dam' | 'sire' | 'both' | 'roll' | 'up' | 'mutation';

/** What a card calls each of them, and what each means in the rules. */
export const TRAIT_SOURCES: Record<TraitSource, { label: string; means: string }> = {
  dam: { label: 'from the dam', means: 'drawn from a trait the dam carries and the sire does not' },
  sire: { label: 'from the sire', means: 'drawn from a trait the sire carries and the dam does not' },
  both: { label: 'from both', means: 'drawn from a trait the dam and the sire both carry' },
  roll: { label: 'fresh draw', means: 'drawn from the wild table, weighted towards the better rarities by the breeder’s husbandry' },
  up: { label: 'bred up', means: 'one rarity above what its slot drew, as a grade up its own name for fighting blood and a trait of the rarity above for the rest' },
  mutation: { label: 'mutation', means: `a trait neither parent carries, one rarity above the best of theirs, which 1 young in ${MUTATION_ODDS} is born with in its lowest slot` },
};

/** What a pairing throws: the traits, and where each of them came from. */
export interface Bred {
  traits: string[];
  /** By trait id. */
  from: Record<string, TraitSource>;
}

/**
 * What a pairing throws. Three slots, and for each of them the blood of the
 * parents is drawn on first — weighted, as husbandry rises, towards the best
 * of what the two of them carry — and then given its chance to come through
 * better than either of them had it.
 *
 * And where each trait came from, which the young one keeps as its pedigree.
 * One drawn from the pair is the dam's, the sire's or both of theirs by which
 * of them carries that very trait, grade and all: to the draw two grades of
 * one name are one name, but a fanged (rare) young one of a fanged sire and a
 * fanged (rare) dam had its grade from her. A slot the wild filled, or a
 * short draw topped up, is a fresh roll; and one that came through a tier
 * better is bred up, whatever it was drawn from.
 */
export function breedTraits(
  sire: string[],
  dam: string[],
  husbandry: number,
  care: number,
  rand: () => number,
  keepPlus = 0,
  upPlus = 0,
): Bred {
  const pool = [...new Set([...sire, ...dam])];
  // More of the pair and more of it a tier better, for a Herdsman's True Blood and Bred Up; never past certain.
  const keep = Math.min(1, inheritChance(husbandry, care) + keepPlus);
  const up = Math.min(1, upgradeChance(husbandry, care) + upPlus);
  const lift = Math.max(0, Math.min(100, husbandry)) / 100;
  const out: string[] = [];
  const from: Record<string, TraitSource> = {};
  for (let slot = 0; slot < TRAIT_SLOTS; slot++) {
    // What the pair carry that the foal does not, by name: two grades of one name are one name.
    const left = pool.filter((id) => !holds(out, id));
    let id: string | null = null;
    let source: TraitSource = 'roll';
    if (left.length && rand() < keep) {
      // A good keeper's eye falls on the best of what the pair carry.
      const weights = left.map((t) => 1 + TIERS.indexOf(traitTier(t)) * lift * 2.4);
      let r = rand() * weights.reduce((a, b) => a + b, 0);
      id = left[left.length - 1];
      for (let i = 0; i < left.length; i++) {
        r -= weights[i];
        if (r < 0) {
          id = left[i];
          break;
        }
      }
      source = dam.includes(id) ? (sire.includes(id) ? 'both' : 'dam') : 'sire';
    } else {
      id = rollTrait(rand, out, husbandry);
    }
    if (!id) continue;
    // And then the chance that it comes through better than it went in. Fighting
    // blood climbs a grade of its own name; a plain trait climbs into the tier above.
    if (rand() < up) {
      const above = nextTier(traitTier(id));
      const fam = TRAIT_BY_ID.get(id)?.family;
      if (above && fam) {
        id = gradeId(fam, above);
        source = 'up';
      } else {
        const room = above ? BY_TIER[above].filter((t) => !holds(out, t.id)) : [];
        if (room.length) {
          id = pick(room, rand).id;
          source = 'up';
        }
      }
    }
    if (!holds(out, id)) {
      out.push(id);
      from[id] = source;
    }
  }
  // A short straw in the draw never leaves a foal with fewer than three.
  while (out.length < TRAIT_SLOTS) {
    const id = rollTrait(rand, out, husbandry);
    if (!id) break;
    out.push(id);
    from[id] = 'roll';
  }
  /*
   * And one young in `MUTATION_ODDS` is born with something neither of them
   * has. Asked for: "one birth in 200, the foal gets a trait that neither
   * parent carries, at one tier above the best tier among the parents' traits.
   * It takes the foal's lowest-tier trait slot after normal inheritance (an
   * empty slot first)." Never a name either parent carries or the young one
   * already does, by the rule an ancient lamp keeps (`lampTrait`).
   */
  if (rand() < 1 / MUTATION_ODDS) {
    const { slot } = lowestSlot(out, rand);
    const now = lampTrait(mutationTier(sire, dam), [...sire, ...dam, ...out], rand);
    if (now) {
      if (out[slot] !== undefined) delete from[out[slot]];
      out[slot] = now;
      from[now] = 'mutation';
    }
  }
  return { traits: out, from };
}

/** The tier a mutation comes in at: one above the best either parent carries, and the top tier at the top. */
export const mutationTier = (sire: string[], dam: string[]): TraitTier => {
  const best = bestTier([...sire, ...dam]);
  return nextTier(best) ?? best;
};

/** The trait a mutation brought, from where each came from; null for a young one with none. */
export const mutationOf = (from: Record<string, TraitSource> | undefined): string | null =>
  Object.keys(from ?? {}).find((id) => from?.[id] === 'mutation') ?? null;

// ---- A line ----

/**
 * How deep a line runs: on each channel (`CHANNELS`), the generations in a row,
 * ending with the creature itself, that carried a trait on it. Asked for: "a
 * foal's depth on a channel = 1 + max(dam's depth, sire's depth) on that
 * channel if the foal carries a trait on that channel, else 0. Wild-caught or
 * spawned ones: 1 on each channel they carry a trait on, else 0. Cap at
 * PEDIGREE_MOST = 5."
 */
export const PEDIGREE_MOST = 5;
/** What each generation past the first adds to a channel, as a share: `PEDIGREE_STEP` × (depth − 1). */
export const PEDIGREE_STEP = 0.02;

/**
 * The depths a young one is born with, written down where they are past one:
 * the pedigree's `line`. A channel it is not written for is one, where it
 * carries a trait on it; which is what everything caught, spawned or born
 * before lines were kept stands at, without a word written to it.
 */
export type Line = Partial<Record<TraitChannel, number>>;

/** Whether a set of traits carries anything on a channel. */
export const carriesOn = (traits: string[] | undefined, channel: TraitChannel): boolean =>
  (traits ?? []).some((id) => TRAIT_BY_ID.get(id)?.effects[channel] !== undefined);

/**
 * How deep its line runs on a channel: nought where it carries no trait on it
 * (an ancient lamp may have taken it away since), the depth written down where
 * there is one, and one otherwise; never past `PEDIGREE_MOST`.
 */
export const lineDepth = (traits: string[] | undefined, line: Line | undefined, channel: TraitChannel): number =>
  carriesOn(traits, channel) ? Math.max(1, Math.min(PEDIGREE_MOST, line?.[channel] ?? 1)) : 0;

/**
 * What its line is worth on a channel: `PEDIGREE_STEP` more for every
 * generation past the first, and as much less on a channel where less is
 * better, as a rarity is (`rarityMul`). One at depth one and none.
 */
export function lineMul(traits: string[] | undefined, line: Line | undefined, channel: TraitChannel): number {
  const d = line?.[channel];
  return d === undefined || d <= 1 ? 1 : depthMul(lineDepth(traits, line, channel), channel);
}

/** What a line this deep is worth on a channel. */
export function depthMul(depth: number, channel: TraitChannel): number {
  const k = 1 + PEDIGREE_STEP * (Math.max(1, Math.min(PEDIGREE_MOST, depth)) - 1);
  return CHANNEL_BY_ID.get(channel)?.up === false ? 1 / k : k;
}

/** The depth a young one of this pair would have on a channel if it carries a trait on it. */
export const lineIfCarried = (dam: { traits: string[]; line?: Line }, sire: { traits: string[]; line?: Line }, channel: TraitChannel): number =>
  Math.min(PEDIGREE_MOST, 1 + Math.max(lineDepth(dam.traits, dam.line, channel), lineDepth(sire.traits, sire.line, channel)));

/** A young one's line, settled at the covering with its traits: the channels it carries a trait on where that is past one. The island's `bred_line`. */
export function bredLine(young: string[], dam: { traits: string[]; line?: Line }, sire: { traits: string[]; line?: Line }): Line {
  const out: Line = {};
  for (const ch of CHANNELS) {
    if (!carriesOn(young, ch.id)) continue;
    const d = lineIfCarried(dam, sire, ch.id);
    if (d > 1) out[ch.id] = d;
  }
  return out;
}

/** "Line: 4 generations bred for damage, +6% damage", for each channel its line runs past one on. */
export const lineSaid = (traits: string[] | undefined, line: Line | undefined): string[] =>
  CHANNELS.filter((ch) => lineDepth(traits, line, ch.id) > 1)
    .map((ch) => `Line (${ch.label}): ${lineDepth(traits, line, ch.id)} generations, ${pct(depthMul(lineDepth(traits, line, ch.id), ch.id))} ${ch.label}`);

// ---- What a pairing would throw ----

/** How many coverings a breeding preview runs through `breedTraits` itself, from one seed, so a pair reads the same each time it is looked at. */
export const PREVIEW_GOES = 4000;
const PREVIEW_SEED = 20261020;
/** A seeded roll, the same run of numbers each time. */
export const seededRand = (seed: number): (() => number) => {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
};

/** What a pairing throws, as shares of the young it would have. */
export interface BreedOdds {
  /** For each trait either parent carries, the share of young born carrying that very trait. */
  carry: Record<string, number>;
  /** The share whose best trait is of each tier. */
  best: Record<TraitTier, number>;
  /** The share carrying a trait on each channel. */
  on: Record<TraitChannel, number>;
  /** The share born with a mutation. */
  mutated: number;
}

/**
 * What a pairing would throw, counted off `breedTraits` itself -- the very
 * draw the covering makes, mutation and all -- run `goes` times. It cannot say
 * anything the covering does not do, because it is the covering.
 */
export function breedOdds(sire: string[], dam: string[], husbandry: number, care: number, keepPlus = 0, upPlus = 0,
  goes = PREVIEW_GOES, rand: () => number = seededRand(PREVIEW_SEED)): BreedOdds {
  const carry: Record<string, number> = Object.fromEntries([...new Set([...sire, ...dam])].map((id) => [id, 0]));
  const best = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<TraitTier, number>;
  const on = Object.fromEntries(CHANNELS.map((ch) => [ch.id, 0])) as Record<TraitChannel, number>;
  let mutated = 0;
  for (let i = 0; i < goes; i++) {
    const bred = breedTraits(sire, dam, husbandry, care, rand, keepPlus, upPlus);
    for (const id of bred.traits) if (id in carry) carry[id]++;
    best[bestTier(bred.traits)]++;
    for (const ch of CHANNELS) if (carriesOn(bred.traits, ch.id)) on[ch.id]++;
    if (mutationOf(bred.from)) mutated++;
  }
  const share = <K extends string>(r: Record<K, number>): Record<K, number> =>
    Object.fromEntries(Object.entries(r).map(([k, n]) => [k, (n as number) / goes])) as Record<K, number>;
  return { carry: share(carry), best: share(best), on: share(on), mutated: mutated / goes };
}

// ---- An ancient lamp ----

/**
 * One time in this many, the trait an ancient lamp kindles is a tier above the
 * one that went out (`TIERS`); at the top tier there is nothing above, and it
 * is another of the top tier. The island's `lamp_tier_odds`.
 */
export const LAMP_TIER_ODDS = 20;

/**
 * A fresh trait of one tier that a set does not carry by name, as `rollTrait`
 * keeps it: fighting blood `FIGHT_SHARE` of the time, a name not in the set in
 * that grade, and otherwise a plain trait of that tier; the other where one has
 * none left. Null with nothing of that tier left at all. The island's `lamp_trait`.
 */
export function lampTrait(tier: TraitTier, taken: string[], rand: () => number): string | null {
  const fights = FIGHTING.filter((f) => !holds(taken, f.id));
  const plain = BY_TIER[tier].filter((t) => !holds(taken, t.id));
  if (fights.length && (!plain.length || rand() < FIGHT_SHARE)) return gradeId(pick(fights, rand).id, tier);
  return plain.length ? pick(plain, rand).id : null;
}

/** What an ancient lamp did: which slot, what went out of it (null for an empty one), and what came in at which tier. */
export interface Rekindled {
  slot: number;
  was: string | null;
  /** The tier of what went out, or the lowest tier for an empty slot. */
  from: TraitTier;
  now: string;
  tier: TraitTier;
  /** A tier above the one that went out, the one time in `LAMP_TIER_ODDS`. */
  up: boolean;
}

/**
 * An ancient lamp on a wildermon's blood. It rekindles its lowest-tier trait,
 * one at random of those that share the lowest tier, into another trait at that
 * tier, or one time in `LAMP_TIER_ODDS` the tier above; never lower, and never
 * one it carries by name, the one going out included. One with fewer than
 * `TRAIT_SLOTS` traits has an empty slot, which is lower than any trait, and
 * the lamp fills that as the lowest tier there is. The new set, and what
 * happened; null when nothing could be kindled. The island's `perform_artifact`.
 */
/**
 * The lowest-tier slot in a set, one at random of those that share the lowest
 * tier, and its tier; an empty slot first, which is lower than any trait and
 * counts as the lowest tier there is. What an ancient lamp rekindles and what a
 * mutation takes.
 */
export function lowestSlot(traits: string[], rand: () => number): { slot: number; from: TraitTier } {
  if (traits.length < TRAIT_SLOTS) return { slot: traits.length, from: TIERS[0] };
  const rank = (id: string): number => TIERS.indexOf(traitTier(id));
  const low = Math.min(...traits.map(rank));
  const lowest = traits.flatMap((id, i) => (rank(id) === low ? [i] : []));
  return { slot: pick(lowest, rand), from: TIERS[low] };
}

export function rekindle(traits: string[], rand: () => number): { traits: string[]; did: Rekindled } | null {
  const { slot, from } = lowestSlot(traits, rand);
  const above = rand() < 1 / LAMP_TIER_ODDS ? nextTier(from) : null;
  const tier = above ?? from;
  const now = lampTrait(tier, traits, rand);
  if (!now) return null;
  const out = [...traits];
  out[slot] = now;
  return { traits: out, did: { slot, was: traits[slot] ?? null, from, now, tier, up: !!above } };
}
