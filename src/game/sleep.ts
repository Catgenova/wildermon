/**
 * Sleep, as Wurm has it: Sleep in a bed you may use and you log off; while you
 * are logged off in it you gain sleep bonus, and sleep bonus switched on
 * doubles skill gain while it drains.
 *
 * The island keeps all of it (`private.asleep`, `player.rested`,
 * `player.sleep_on`, `rest_left`, `sleep_wake`, `rpc_sleep_bonus`); the numbers
 * and the words are here, generated into it by `npm run defs`, and the browser
 * draws what the island says.
 *
 *   * Sleep (`placeables.ts`): refused on a bed that is neither yours nor on a
 *     settlement of yours, in a fight, mounted, or with another job going. Done,
 *     the body is logged off asleep in that bed.
 *   * Coming back (`rpc_join`): `sleepGain` of the time asleep is added to what
 *     is stored, to `sleepCap`; the body stands on a free tile beside the bed,
 *     or where it stood if it is gone; `sleptSaid` is told.
 *   * Logged off anywhere else: no sleep bonus.
 *   * Switched on (`rpc_sleep_bonus`, the Skills window, the status panel, `\`):
 *     skill gain ×`SLEEP_BONUS_MULT` while any is left, draining one second a
 *     second while you are on the island. Switched off, or logged off, it keeps.
 */

/** Sleep bonus gained per second asleep in a bed (`bed` 1) of QL 0. */
export const SLEEP_BONUS_RATE = 1 / 3;
/** The most sleep bonus stored, in seconds. */
export const SLEEP_BONUS_CAP = 5 * 3600;
/** Skill gain while sleep bonus is on and any is left. */
export const SLEEP_BONUS_MULT = 2;
/** A bed's QL adds this share of the rate per point: × (1 + QL / `SLEEP_BONUS_QL`). */
export const SLEEP_BONUS_QL = 200;
/** Health back on lying down, × the bed's rest (`bedRest`). */
export const SLEEP_HEAL = 0.25;
/** Food used up by lying down. */
export const SLEEP_FOOD = 0.2;
/** Water used up by lying down. */
export const SLEEP_WATER = 0.25;

/** A bed's rest on lying down, by its worth (`FurnitureDef.bed`) and QL: × `SLEEP_HEAL` health. */
export const bedRest = (bed: number, ql: number): number => bed * (0.6 + ql / 250);

/**
 * Sleep bonus gained per second asleep: the bed's own worth (`FurnitureDef.bed`: a bed 1, a cot and a tent less),
 * its QL, and a Dreamweave set into it (`dream`, its share more).
 */
export const sleepRate = (bed: number, ql: number, dream = 0): number =>
  SLEEP_BONUS_RATE * bed * (1 + Math.max(0, Math.min(100, ql)) / SLEEP_BONUS_QL) * (1 + dream);

/** The most stored after sleeping in a bed with a Dreamweave of `dream` in it. */
export const sleepCap = (dream = 0): number => SLEEP_BONUS_CAP * (1 + dream);

/**
 * What is stored after `seconds` asleep at `rate`, from `was`: up to the cap, and never less than was stored
 * (a store over the cap from a Dreamweave bed keeps). The island's `sleep_banked`.
 */
export const sleepBanked = (was: number, seconds: number, rate: number, dream = 0): number =>
  Math.max(was, Math.min(sleepCap(dream), was + Math.max(0, seconds) * rate));

/** A stretch of time as the sleep lines say it: "2 h 5 m", "45 m". Whole minutes, rounded down. The island's `sleep_hm`. */
export function sleepHm(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} h ${m % 60} m` : `${m % 60} m`;
}

/** What both sides say. */
export const SLEEP_SAID = {
  busy: 'Finish or stop your current action first.',
  fight: 'Not in a fight.',
  mounted: 'Dismount first.',
  /** Anything asked of a body logged off asleep. */
  asleep: 'Asleep.',
  /** Told when what was stored runs out while on. */
  used: 'Sleep bonus used up: skill gain ×1.',
} as const;

/** Refused on a bed that is neither yours nor on a settlement of yours: "Not yours: bed." */
export const sleepNotYours = (name: string): string => `Not yours: ${name.toLowerCase()}.`;

/** The line told on waking. The island's `sleep_slept_said`. */
export const sleptSaid = (asleep: number, gained: number, stored: number): string =>
  `Slept ${sleepHm(asleep)}: sleep bonus +${sleepHm(gained)} (${sleepHm(stored)} stored).`;

/** What the toggle reads: "Sleep bonus: on · 2 h 5 m left". */
export const sleepBonusLabel = (on: boolean, left: number): string =>
  `Sleep bonus: ${on ? 'on' : 'off'} · ${sleepHm(left)} left`;

/** The line told when it is switched. The island's `sleep_switch_said`. */
export const sleepSwitchSaid = (on: boolean, left: number): string =>
  on
    ? `Sleep bonus: on. Skill gain ×${SLEEP_BONUS_MULT}; ${sleepHm(left)} left.`
    : `Sleep bonus: off. ${sleepHm(left)} stored.`;

/** What the boot card says of a body logged off asleep. */
export const asleepIn = (name: string): string => `Asleep in ${name.toLowerCase()}`;
