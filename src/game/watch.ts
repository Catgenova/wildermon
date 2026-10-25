/**
 * The island's watch, as its keepers read it: the flags the island raises on
 * its own clock (`private.watch_sweep`, `private.watch_night`) and hands to
 * the Island keeper window through `rpc_owner_flags`.
 *
 * The numbers are the island's (`watch_*()` in the migration that made the
 * watch); `supabase/test/watch.ts` holds these to them.
 */

/** Days a flag is kept, seen or not. */
export const WATCH_KEEP_DAYS = 30;
/** Hours of activity with no break that raise an Awake flag. */
export const WATCH_AWAKE_HOURS = 20;
/** Minutes with no move and no action that count as a break. */
export const WATCH_BREAK_MINS = 30;
/** How many times an hour's honest best a skill must rise in an hour to be flagged. */
export const WATCH_SKILL_TIMES = 3;
/** Minutes a skill's rise is measured over. */
export const WATCH_SKILL_MINS = 60;
/** Parts in a thousand an item's total may be off the ledger before it is flagged; any difference at all under a thousand. */
export const WATCH_STOCK_PER_MILLE = 1;
/** How many times the most goes a minute a body's gathering, crafting or looting must come due at to be flagged. */
export const WATCH_RATE_TIMES = 3;
/** The fewest goes measured before a work rate is flagged. */
export const WATCH_RATE_LEAST = 10;

/** The kinds of flag, and the label each is shown under. */
export const FLAG_KINDS = {
  shared_ip: 'Shared IP',
  awake: 'No break',
  skill: 'Skill rate',
  stock: 'Stock off ledger',
  no_door: 'Made outside any door',
  rate: 'Work rate',
} as const;
export type FlagKind = keyof typeof FLAG_KINDS;

/** One flag, as `rpc_owner_flags` sends it. Each kind fills its own part of `detail`. */
export interface WatchFlag {
  n: number;
  kind: FlagKind | string;
  /** Who it is about, if anybody, and their name on the island. */
  uid: string | null;
  name: string | null;
  /** Seconds since it was raised. */
  ago: number;
  seen: boolean;
  detail: Record<string, unknown>;
}

/** Every flag kept on the island, newest first, and how many are not seen yet. */
export interface WatchFlags {
  flags: WatchFlag[];
  open: number;
}

/** The ways a thing changes hands, as a Shared IP flag names them. */
const VIA: Record<string, string> = {
  rpc_barter_accept: 'trade',
  rpc_deal_answer: 'deal',
  rpc_parcel: 'parcel',
  rpc_collect: 'parcel',
  rpc_buy: 'stall',
  ground: 'dropped and picked up',
};
export const viaWord = (via: string): string => VIA[via] ?? via;

/** The kinds of go a Work rate flag counts. */
const RATE_KIND: Record<string, string> = { gather: 'Gathering', craft: 'Crafting', loot: 'Looting' };

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0));
const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''));
const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** What one flag says, after its label: the numbers behind it. */
export function flagLine(f: WatchFlag): string {
  const d = f.detail;
  switch (f.kind) {
    case 'shared_ip': {
      const vias = Array.isArray(d.via) ? (d.via as string[]).map(viaWord).join(', ') : viaWord(str(d.via));
      const parts = [`${str(d.giver_name)} to ${str(d.getter_name)}`];
      if (num(d.things) > 0) parts.push(`${num(d.things)} things`);
      if (num(d.silver) > 0) parts.push(`${num(d.silver)} silver`);
      parts.push(`by ${vias}`, `IP ${str(d.ip)}`);
      return parts.join(' · ');
    }
    case 'awake':
      return `${num(d.hours)} h active, no break of ${WATCH_BREAK_MINS} min`;
    case 'skill':
      return `${str(d.skill)}: ${round2(num(d.from))} to ${round2(num(d.to))} (${signed(round2(num(d.to) - num(d.from)))}) `
        + `in ${num(d.mins)} min · ${num(d.goes)} best goes' worth, ${num(d.ceiling)} possible · ${num(d.times)}×`;
    case 'stock':
      return `${str(d.name)}: ${signed(num(d.diff))} · start of ${str(d.day)}: ${num(d.found)} counted, ${num(d.expected)} by ledger`;
    case 'no_door':
      return `${str(d.name)}: ${num(d.count)} on ${str(d.day)}`;
    case 'rate':
      return `${RATE_KIND[str(d.kind)] ?? str(d.kind)}, ${str(d.act)}: ${num(d.goes)} goes in ${num(d.secs)} s · `
        + `${num(d.per_min)}/min, ${num(d.most)}/min possible · ${num(d.times)}×`;
    default:
      return JSON.stringify(d);
  }
}

/** The kind's label, for the head of a flag's row. */
export const flagLabel = (kind: string): string => (FLAG_KINDS as Record<string, string>)[kind] ?? kind;
