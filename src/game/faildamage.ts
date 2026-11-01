import { itemDef, type Item } from './items';
import { DAMAGE_MAX } from './limits';

/*
 * A failed craft damages what it would have used.
 *
 * Asked for: "failing a craft damages all ingredients, more damage at 1ql and
 * very little at 99ql, but crafts like smelters dont automatically destroy it
 * all". A go that did not come off used to do one of two things: keep every
 * input, or -- on food, smelting, kiln work and the rest -- throw every input
 * away. It does neither now. Every unit of every input the go would have spent,
 * off the stacks it would have spent them from and in that order, takes damage
 * by its own QL: `FAIL_DAMAGE_AT_LOW` at `FAIL_DAMAGE_QL_LOW` and below,
 * `FAIL_DAMAGE_AT_HIGH` at `FAIL_DAMAGE_QL_HIGH` and above, in a straight line
 * between, to the whole point. A unit it takes to `DAMAGE_MAX` is gone. A
 * litre input loses that share of the litres it would have taken, the vessel
 * left as it is. The island's `fail_damage` and `craft_fail_damage`.
 */

/** Damage a failed go puts on a unit of an input at `FAIL_DAMAGE_QL_LOW` or lower. The island's `fail_damage_at_low()`. */
export const FAIL_DAMAGE_AT_LOW = 50;
/** Damage a failed go puts on a unit of an input at `FAIL_DAMAGE_QL_HIGH` or higher. The island's `fail_damage_at_high()`. */
export const FAIL_DAMAGE_AT_HIGH = 1;
/** The QL the most damage is put on. The island's `fail_damage_ql_low()`. */
export const FAIL_DAMAGE_QL_LOW = 1;
/** The QL the least damage is put on. The island's `fail_damage_ql_high()`. */
export const FAIL_DAMAGE_QL_HIGH = 99;

/** The damage a failed go puts on one unit of an input of this QL, a whole number. The island's `fail_damage`. */
export function failDamage(ql: number): number {
  const q = Math.min(FAIL_DAMAGE_QL_HIGH, Math.max(FAIL_DAMAGE_QL_LOW, ql));
  return Math.floor(FAIL_DAMAGE_AT_LOW + (FAIL_DAMAGE_AT_HIGH - FAIL_DAMAGE_AT_LOW) * (q - FAIL_DAMAGE_QL_LOW)
    / (FAIL_DAMAGE_QL_HIGH - FAIL_DAMAGE_QL_LOW) + 0.5);
}

/** The curve in words, for help and perk text: "+50 damage at QL 1 to +1 at QL 99". */
export const FAIL_DAMAGE_SAID = `+${FAIL_DAMAGE_AT_LOW} damage at QL ${FAIL_DAMAGE_QL_LOW} to +${FAIL_DAMAGE_AT_HIGH} at QL ${FAIL_DAMAGE_QL_HIGH}`;

/** A stack a failed go draws on: what it is, and how to take units of it away. */
export interface FailStack {
  item: Item;
  spend(n: number): boolean;
  touched?: () => void;
}

const lower = (id: string): string => itemDef(id).name.toLowerCase();

/** One stack's part of a failed go, as it is said: "log ×1, +38 damage", "log ×1, destroyed". The island's `craft_fail_part`. */
export const failPartSaid = (id: string, n: number, dmg: number, gone: boolean): string =>
  `${lower(id)} ×${n}, ${gone ? 'destroyed' : `+${dmg} damage`}`;

/** A litre input's part of a failed go, by the liquid's name: "water 2 L, 1 L lost". The island's `fail_litres_said`. */
export const failLitresSaid = (liquid: string, need: number, lost: number): string => `${liquid} ${need} L, ${lost} L lost`;

/** The litres of `need` a failed go loses out of one source of this QL, to the whole litre (`failLitres`). */
export const failLitresOf = (need: number, ql: number): number => Math.floor((need * failDamage(ql)) / DAMAGE_MAX + 0.5);

/** What a failed go says: its head, and what was damaged. "Failed: plank. Inputs damaged: log ×1, +38 damage." */
export const failDamagedSaid = (head: string, parts: readonly string[]): string =>
  (parts.length ? `${head} Inputs damaged: ${parts.join('; ')}.` : head);

/**
 * Put a failed go's damage on `n` units drawn from `from`, in its order: each
 * stack's units by its own QL (`failDamage`), the pile's damage up by that
 * over its count -- a pile's damage is by the unit, as `foldInto` keeps it --
 * or, where that takes the units to `DAMAGE_MAX`, the units gone. What it did,
 * stack by stack, in words (`failPartSaid`).
 */
export function damageDrawn(from: readonly FailStack[], n: number): string[] {
  const said: string[] = [];
  let left = n;
  for (const s of from) {
    if (left <= 0) break;
    const it = s.item;
    const take = Math.min(left, it.count);
    if (take <= 0) continue;
    const dmg = failDamage(it.ql);
    const id = it.id;
    if (it.dmg + dmg >= DAMAGE_MAX) {
      if (!s.spend(take)) continue;
      said.push(failPartSaid(id, take, dmg, true));
    } else {
      it.dmg += (dmg * take) / it.count;
      s.touched?.();
      said.push(failPartSaid(id, take, dmg, false));
    }
    left -= take;
  }
  return said;
}

/** A source of litres a failed go draws on: how many it holds, the QL of what is in it, and how to take some. */
export interface FailLitres {
  litres: number;
  ql: number;
  take(n: number): boolean;
}

/**
 * The litres a failed go loses of the `need` it would have taken across
 * `sources`, in their order: of each source's share, `failDamage` of its QL
 * as a share of `DAMAGE_MAX`, added up and rounded to the whole litre. Those
 * are taken, from the front, as a go takes them. How many, for the words.
 */
export function failLitres(sources: readonly FailLitres[], need: number): number {
  let left = need;
  let lost = 0;
  for (const s of sources) {
    if (left <= 0) break;
    const m = Math.min(left, s.litres);
    if (m <= 0) continue;
    lost += (m * failDamage(s.ql)) / DAMAGE_MAX;
    left -= m;
  }
  const whole = Math.floor(lost + 0.5);
  let take = whole;
  for (const s of sources) {
    if (take <= 0) break;
    const m = Math.min(take, s.litres);
    if (m > 0 && s.take(m)) take -= m;
  }
  return whole;
}
