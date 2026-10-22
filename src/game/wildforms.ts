/**
 * Wild forms: a rare colour and a rare size a wild one may come in.
 *
 * Asked for: "rare forms in the wild: a colour form (a fifth palette per kind,
 * distinct from its four variants) at 1 in 500 wild spawns, and a size form
 * (large +15% drawn size and +10% health, or small −15% size and +10% speed)
 * at 1 in 200, independent. Kept when tamed; passed to young with a stated
 * chance."
 *
 *   * The colour form is the kind's own palette made over (`formCoat`): a
 *     kind none of whose variants has a coat as light as `PALE_AT` comes in a
 *     pale form, its first variant lightened; a kind with one comes in a dark
 *     form, its first variant darkened. Either way it is a fifth palette,
 *     never one of its four.
 *   * The size form is large or small, half of them each.
 *   * Both are rolled where one is put out in the wild, each off a roll of
 *     its own (`wildFormRoll`), and never for a monster. A young one has each
 *     at `FORM_PASS` for each parent that has it (`bredForm`).
 *
 * The island keeps them on the creature (`form_colour`, `form_size`), rolls
 * them in `wild_form_put` and `wild_form_roll`, passes them on in
 * `bred_form`, and sends them with the creature (`formColour`, `formSize`).
 */
import type { SpeciesDef } from './creatures';
import type { TraitChannel } from './traits';
import { percent } from './words';

/** One wild spawn in this many comes in its kind's colour form. The island's `colour_form_odds`. */
export const COLOUR_FORM_ODDS = 500;
/** One wild spawn in this many comes in a size form, large or small, half each. The island's `size_form_odds`. */
export const SIZE_FORM_ODDS = 200;
/** A large one: drawn this much bigger, and this much more health. The island's `large_health`. */
export const LARGE_SIZE = 1.15;
export const LARGE_HEALTH = 1.1;
/** A small one: drawn this much smaller, and this much faster. The island's `small_speed`. */
export const SMALL_SIZE = 0.85;
export const SMALL_SPEED = 1.1;
/** The chance a young one has a form for each parent that has it. The island's `form_pass`. */
export const FORM_PASS = 0.25;

export type SizeForm = 'large' | 'small';
export const SIZE_FORMS: readonly SizeForm[] = ['large', 'small'];
/** A form a guide page marks: the colour form, or a size. */
export type FormId = 'colour' | SizeForm;
export const FORM_IDS: readonly FormId[] = ['colour', 'large', 'small'];

/** What a creature carries of them. */
export interface Forms {
  formColour?: boolean;
  formSize?: SizeForm | null;
}

/**
 * Its forms off two rolls, each a share of one: the colour form under one in
 * `COLOUR_FORM_ODDS`, and under one in `SIZE_FORM_ODDS` a size form, large
 * for the lower half and small for the upper. Never for a monster. The
 * island's `wild_form_roll`.
 */
export function wildFormRoll(def: Pick<SpeciesDef, 'monster'>, colourRoll: number, sizeRoll: number): { formColour: boolean; formSize: SizeForm | null } {
  if (def.monster) return { formColour: false, formSize: null };
  return {
    formColour: colourRoll < 1 / COLOUR_FORM_ODDS,
    formSize: sizeRoll < 1 / (2 * SIZE_FORM_ODDS) ? 'large' : sizeRoll < 1 / SIZE_FORM_ODDS ? 'small' : null,
  };
}

/**
 * A young one's forms off its dam's and its sire's and two rolls: each form
 * at `FORM_PASS` for each parent that has it, the dam's size before the
 * sire's where both have one. The island's `bred_form`.
 */
export function bredForm(dam: Forms, sire: Forms, colourRoll: number, sizeRoll: number): { formColour: boolean; formSize: SizeForm | null } {
  const colours = (dam.formColour ? 1 : 0) + (sire.formColour ? 1 : 0);
  const sizes = [dam.formSize, sire.formSize].filter((s): s is SizeForm => !!s);
  const k = Math.floor(sizeRoll / FORM_PASS);
  return { formColour: colourRoll < FORM_PASS * colours, formSize: k < sizes.length ? sizes[k] : null };
}

/** How much bigger or smaller it is drawn for its size form. */
export const formScale = (c: Forms): number => (c.formSize === 'large' ? LARGE_SIZE : c.formSize === 'small' ? SMALL_SIZE : 1);

/** What its size form does to its blood on a channel: health for a large one, speed for a small. The island's `form_mul`. */
export const formMul = (c: Forms, channel: TraitChannel): number =>
  (c.formSize === 'large' && channel === 'hardy' ? LARGE_HEALTH : c.formSize === 'small' && channel === 'speed' ? SMALL_SPEED : 1);

/* ---- the colour form ---------------------------------------------------------------- */

/** A kind whose variants have no coat this light comes in a pale form; one with one, in a dark. */
export const PALE_AT = 0.8;
/** The lightness the pale form's coat and markings are set to, and the dark form's. */
const PALE_COAT = 0.9;
const PALE_MARK = 0.78;
const DARK_COAT = 0.14;
const DARK_MARK = 0.32;

type Hsl = [number, number, number];
function hsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hex([h, s, l]: Hsl): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number): number => {
    const u = ((t % 1) + 1) % 1;
    return u < 1 / 6 ? p + (q - p) * 6 * u : u < 0.5 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
  };
  return `#${[h / 360 + 1 / 3, h / 360, h / 360 - 1 / 3].map((t) => Math.round(f(t) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** Whether a kind's colour form is its pale one: none of its variants' coats is as light as `PALE_AT`. */
export const paleKind = (def: Pick<SpeciesDef, 'variants'>): boolean => def.variants.every(([coat]) => hsl(coat)[2] < PALE_AT);

const coats = new Map<string, [string, string]>();
/** A kind's colour form: its first variant's coat and markings at the pale form's lightness, or the dark form's. */
export function formCoat(def: Pick<SpeciesDef, 'id' | 'variants'>): [string, string] {
  let had = coats.get(def.id);
  if (!had) {
    const [coat, mark] = def.variants[0];
    const pale = paleKind(def);
    const [ch, cs] = hsl(coat), [mh, ms] = hsl(mark);
    had = pale ? [hex([ch, cs * 0.6, PALE_COAT]), hex([mh, ms, Math.max(hsl(mark)[2], PALE_MARK)])] : [hex([ch, cs, DARK_COAT]), hex([mh, ms, DARK_MARK])];
    coats.set(def.id, had);
  }
  return had;
}

/** The two colours it is drawn in: its colour form's, or its variant's. */
export const coatOf = (c: Forms & { variant: number }, def: Pick<SpeciesDef, 'id' | 'variants'>): [string, string] =>
  (c.formColour ? formCoat(def) : def.variants[c.variant] ?? def.variants[0]);

/** What a form is called, for a kind: "Pale form", "Dark form", "Large form", "Small form". */
export function formName(def: Pick<SpeciesDef, 'variants'>, form: FormId): string {
  if (form === 'colour') return paleKind(def) ? 'Pale form' : 'Dark form';
  return form === 'large' ? 'Large form' : 'Small form';
}

/** What a form does, as a label: "size +15%, health +10%". The colour form changes its colours and nothing else. */
export function formGives(form: FormId): string {
  if (form === 'large') return `size +${percent(LARGE_SIZE - 1)}, health +${percent(LARGE_HEALTH - 1)}`;
  if (form === 'small') return `size −${percent(1 - SMALL_SIZE)}, speed +${percent(SMALL_SPEED - 1)}`;
  return 'colours only';
}

/** How often the wild puts one out in a form. */
export const formOdds = (form: FormId): number => (form === 'colour' ? COLOUR_FORM_ODDS : 2 * SIZE_FORM_ODDS);

/** The forms it carries, by id. */
export const formsOf = (c: Forms): FormId[] => [...(c.formColour ? ['colour' as const] : []), ...(c.formSize ? [c.formSize] : [])];

/** Its forms as the card says them: "Pale form: colours only", "Large form: size +15%, health +10%". */
export const formLabels = (c: Forms, def: Pick<SpeciesDef, 'variants'>): string[] =>
  formsOf(c).map((f) => `${formName(def, f)}: ${formGives(f)}`);

/** A form's key in the field guide, beside its kind's page: `species/form`. */
export const formKey = (species: string, form: FormId): string => `${species}/${form}`;
/** The kind and form a guide key is for, or null for a key that is not a form's. */
export function formOfKey(key: string): { species: string; form: FormId } | null {
  const [species, form, more] = key.split('/');
  return more === undefined && form !== undefined && (FORM_IDS as readonly string[]).includes(form) ? { species, form: form as FormId } : null;
}
