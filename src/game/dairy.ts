import { BUCKET_LITRES, BUCKET_OF } from './furniture';
import { describeFrom, ITEM_DEFS, itemDef } from './items';
import { numberWord, NumberWord, percent } from './words';

/**
 * Milk, butter and cheese.
 *
 * A Cudda and a Gorral are milked (`milk_creature`). A Cudda fills an empty
 * bucket at a milking; a Gorral gives `GORRAL_MILK` litres of the
 * `BUCKET_LITRES` a bucket holds, into an empty bucket or a part bucket of
 * milk it has already started, and the bucket is a bucket of milk once the
 * litres in it reach a full one. What a part bucket holds is its `charges`,
 * on both sides.
 *
 * A bucket of milk is drunk, pressed into cheese in a clay bowl, or churned
 * into butter standing at a butter churn (`BUTTER_CHURN`), which hands the
 * bucket back. Cheese and butter keep far longer than the milk they came out
 * of, by their own `decay`, and each says how much longer off the numbers.
 *
 * Pressing cheese hands the bucket back full of whey (`WHEY_BUCKET`), which a
 * kept creature of any kind is fed: a bucket of it fills `WHEY_FEED` of its
 * hunger and the bucket comes back empty. The island's `whey_feed`.
 */

/** The piece butter is churned at, set down like a spindle and stood at. */
export const BUTTER_CHURN = 'butter_churn';
/** The recipe that churns a bucket of milk. */
export const CHURN_BUTTER = 'churn_butter';
/** Pats of butter one bucket of milk churns into. */
export const BUTTER_PATS = 4;
/** Litres of milk one milking of a Gorral gives, where a Cudda fills the bucket. */
export const GORRAL_MILK = 2;
/**
 * How much of its milk has to have come back on a beast before it can be
 * milked again: its `fleece`, which a milking or a shearing takes to nothing.
 * The island's `milk_ready`.
 */
export const MILK_READY = 0.4;
/** A bucket a Gorral has been milked into and that is not full yet. */
export const MILK_PART = 'milk_part';

/**
 * Litres one milking gives, by species: a full bucket off a Cudda, and less
 * off a Gorral. The island's `milk_litres` is generated from this.
 */
export const MILK_LITRES: Record<string, number> = { cudda: BUCKET_LITRES, gorral: GORRAL_MILK };
export const milkLitres = (species: string): number => MILK_LITRES[species] ?? BUCKET_LITRES;

/**
 * The quality of a part bucket topped up: the average of what was in it and
 * what went in, by the litres of each. The island's `milk_part_ql`.
 */
export const toppedQl = (had: number, hadQl: number, added: number, addedQl: number): number =>
  (had * hadQl + added * addedQl) / Math.max(1, had + added);

/**
 * What a milking says, by what the bucket holds after it. A full bucket off a
 * Cudda is said as it always was; a Gorral's says the litres. The island's
 * `milked_says`.
 */
export function milkedSays(name: string, litres: number, ql: number, another = false): string {
  const q = `(QL ${ql.toFixed(1)})`;
  if (litres >= BUCKET_LITRES) return `You milk ${name} into the bucket${another ? ' and fill another' : ''}. ${q}`;
  return `You milk ${name} into the bucket. It holds ${litres} of ${BUCKET_LITRES} litres. ${q}`;
}

/** The bucket a bucket of milk pressed into cheese comes back as. */
export const WHEY_BUCKET = BUCKET_OF.whey;
/**
 * How much of a kept creature's hunger one bucket of whey fills, of the whole
 * of it (1). The island's `whey_feed`.
 */
export const WHEY_FEED = 0.4;

/** What feeding a creature a bucket of whey says. The island's `perform_creature` says the same. */
export const wheyFedSays = (name: string): string => `${name} drinks the bucket of whey. The bucket comes back empty.`;

ITEM_DEFS[WHEY_BUCKET] ??= {
  name: 'Bucket of whey',
  category: 'food',
  weight: 6,
  decay: itemDef('milk_bucket').decay,
  description: `${NumberWord(BUCKET_LITRES)} litres of whey, what is left in the bucket when a bucket of milk is pressed into cheese. `
    + `Feed it to a creature you keep, of any kind: it fills ${percent(WHEY_FEED)} of its hunger and the bucket comes back empty. `
    + 'It can be poured into a barrel or tipped out.',
};

ITEM_DEFS[MILK_PART] ??= {
  name: 'Part bucket of milk',
  category: 'food',
  weight: 3,
  decay: itemDef('milk_bucket').decay,
  fills: BUCKET_LITRES,
  description: `A bucket a Gorral has been milked into: ${numberWord(GORRAL_MILK)} litres to a milking. Milk a Gorral into it again `
    + `and it is a bucket of milk once it holds ${numberWord(BUCKET_LITRES)} litres; what is over that is lost. It is not drunk from until it is full.`,
};

/**
 * How fast each keeps against a bucket of milk where it is left lying: the
 * one number a cheese and a pat of butter are worth carrying for, off the
 * `decay` of each.
 */
const keep = (id: string): number => (itemDef(id).decay ?? 1) / (itemDef('milk_bucket').decay ?? 1);
describeFrom('cheese', { keep: keep('cheese') });
describeFrom('butter', { keep: keep('butter') });
