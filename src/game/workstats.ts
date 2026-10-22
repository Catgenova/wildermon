/**
 * A wildermon's work over its whole life: what it handled by the thing, its
 * cycles and the skill it gained, its best island day, and how long it has
 * spent working, idle (by the reason) and resting.
 *
 * Asked for: "per wildermon lifetime work stats from the existing work
 * ledger: lifetime output by thing, best day (count and date), total time
 * working and total time idle (with the top idle reason)". Read off the day's
 * ledger (`workerlog.ts`) as it is written, so they count exactly what it
 * counts and nothing it does not: what one write of the ledger added
 * (`workFromLedger`) goes onto the lifetime. Time goes on by the reason the
 * worker was standing about for it, or none (`workTime`).
 *
 * The island keeps it as one jsonb on the creature (`work_stats`), written in
 * the same row write as the ledger and the reason (`work_stats_keep`), and
 * sends it to the wildermon's keeper only. The browser keeps the same thing on
 * the `Creature` (`work`) and its card says it (`workLines`).
 */
import { countOf } from './items';
import { durationSaid } from './boons';
import { SKILL_BY_ID } from './skills';
import { listed } from './words';
import type { IdleWhy, LedgerDay, WorkLedger } from './workerlog';

/**
 * How many different things the lifetime counts. A worker handles one or two
 * kinds of thing as a rule; a kind past these is left uncounted, so the
 * record stays the same small size however long it runs. The island's
 * `work_items`.
 */
export const WORK_ITEMS = 12;
/** How many of them the card says: the most, then by name. */
export const WORK_SHOWN = 4;

/**
 * How many seconds past its turn a worker the clock has not settled is read as one nobody is settling, its keeper away
 * or nobody near: on the island the time past its turn counts as idle (`away`) once it is this late. The island's
 * `idle_stale`.
 */
export const IDLE_STALE = 30;

/** The reasons that are rest, not idleness (`IdleWhy`): counted as resting. */
export const REST_WHYS: readonly IdleWhy[] = ['rest', 'bed', 'tired'];

/**
 * A wildermon's lifetime at work. `best` is the island day it handled the
 * most on, and how many; `work`, `rest` and `idle` are seconds, the last by
 * the reason it was idle.
 */
export interface WorkStats {
  goes: number;
  skill: number;
  made: Record<string, number>;
  best: { day: number; n: number } | null;
  work: number;
  rest: number;
  idle: Partial<Record<IdleWhy, number>>;
}

export const emptyWork = (): WorkStats => ({ goes: 0, skill: 0, made: {}, best: null, work: 0, rest: 0, idle: {} });

/** How many things one day's ledger handled. */
export const dayHandled = (d: LedgerDay | null | undefined): number => Object.values(d?.made ?? {}).reduce((n, k) => n + k, 0);

/**
 * What one write of the ledger added, put onto the lifetime: the day's
 * counters as they now stand less what they stood at before (nothing before,
 * on a day the write rolled it onto), and the day it is the best day if it
 * now handled more than the best. The island's `work_stats_ledger`, to the
 * letter.
 */
export function workFromLedger(s: WorkStats | null | undefined, was: WorkLedger | null | undefined, now: WorkLedger | null | undefined): WorkStats {
  const out: WorkStats = s ? { ...s, made: { ...s.made }, idle: { ...s.idle } } : emptyWork();
  // Nothing for a ledger gone back a day, which no work does.
  if (!now || (was && now.day < was.day)) return out;
  const before: LedgerDay | null = was && was.day === now.day ? was.now : null;
  out.goes += now.now.goes - (before?.goes ?? 0);
  out.skill += now.now.skill - (before?.skill ?? 0);
  for (const [item, n] of Object.entries(now.now.made)) {
    const more = n - (before?.made[item] ?? 0);
    if (more > 0 && (item in out.made || Object.keys(out.made).length < WORK_ITEMS)) out.made[item] = (out.made[item] ?? 0) + more;
  }
  const handled = dayHandled(now.now);
  if (handled > 0 && handled > (out.best?.n ?? 0)) out.best = { day: now.day, n: handled };
  return out;
}

/**
 * So many seconds gone by with the worker standing about for `why`, resting
 * for one of `REST_WHYS`, or at work for none. The island's `work_stats_time`.
 */
export function workTime(s: WorkStats | null | undefined, secs: number, why: IdleWhy | null | undefined): WorkStats {
  const out: WorkStats = s ? { ...s, made: { ...s.made }, idle: { ...s.idle } } : emptyWork();
  if (!(secs > 0)) return out;
  if (!why) out.work += secs;
  else if (REST_WHYS.includes(why)) out.rest += secs;
  else out.idle[why] = (out.idle[why] ?? 0) + secs;
  return out;
}

/** What each reason reads as beside the idle time: a label, the cause and nothing else. */
export const IDLE_LABEL: Record<IdleWhy, string> = {
  range: 'nothing in range', stock: 'stores empty', room: 'no room to store', full: 'storage full', far: 'walking home',
  away: 'not settled: keeper away or nobody near', unswept: 'not settled: nobody near', rest: 'resting', bed: 'asleep', tired: 'walking to bed',
  nospar: 'no guard free to spar', yielded: 'yielded a spar',
};

/** The reason it has been idle longest for, and how long; null with no idle time. */
export function topIdle(s: WorkStats | null | undefined): [IdleWhy, number] | null {
  const all = Object.entries(s?.idle ?? {}) as Array<[IdleWhy, number]>;
  all.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return all.length && all[0][1] > 0 ? all[0] : null;
}

/**
 * Its best day, counting the days its ledger still holds: the lifetime's
 * best, or today or yesterday where either beat it before it was written
 * down. Null for a worker that has handled nothing.
 */
export function bestDay(s: WorkStats | null | undefined, l: WorkLedger | null | undefined): { day: number; n: number } | null {
  let best = s?.best ?? null;
  for (const [day, d] of l ? ([[l.day, l.now], [l.day - 1, l.last]] as const) : []) {
    const n = dayHandled(d);
    if (n > 0 && n > (best?.n ?? 0)) best = { day, n };
  }
  return best;
}

/**
 * The card's Work section, as labels: "Handled: 1240 reeds and 30 logs",
 * "Cycles: 512 · +12.40 foraging", "Best island day: 140 handled (day 31)",
 * "Working: 3 h 12 min · Idle: 1 h 5 min (most: nothing in range, 50 min) ·
 * Resting: 40 min". Nothing for one that has never worked.
 */
export function workLines(s: WorkStats | null | undefined, l?: WorkLedger | null, skill?: string | null): string[] {
  if (!s) return [];
  const idle = Object.values(s.idle).reduce((n: number, k) => n + (k ?? 0), 0);
  if (s.goes <= 0 && s.work <= 0 && idle <= 0 && s.rest <= 0 && !Object.keys(s.made).length) return [];
  const lines: string[] = [];
  const made = Object.entries(s.made).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  if (made.length) {
    const shown = made.slice(0, WORK_SHOWN).map(([id, n]) => countOf(id, n, true));
    const more = made.length - WORK_SHOWN;
    lines.push(`Handled: ${listed(more > 0 ? [...shown, `${more} more kind${more === 1 ? '' : 's'}`] : shown)}`);
  }
  const skillName = skill ? (SKILL_BY_ID.get(skill)?.name ?? skill).toLowerCase() : 'skill';
  lines.push(`Cycles: ${s.goes}${s.skill > 0 ? ` · +${s.skill.toFixed(2)} ${skillName}` : ''}`);
  const best = bestDay(s, l);
  if (best) lines.push(`Best island day: ${best.n} handled (day ${best.day})`);
  const top = topIdle(s);
  const times = [`Working: ${durationSaid(s.work)}`, `Idle: ${durationSaid(idle)}${top ? ` (most: ${IDLE_LABEL[top[0]]}, ${durationSaid(top[1])})` : ''}`];
  if (s.rest > 0) times.push(`Resting: ${durationSaid(s.rest)}`);
  lines.push(times.join(' · '));
  return lines;
}
