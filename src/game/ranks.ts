/**
 * A settlement's ranks, and the one question everybody asks of them: may this
 * rank do this here?
 *
 * Here, in a module that imports nothing, rather than in `game.ts`, where they
 * were. The baubles needed the question, and taking it from `game.ts` closed
 * a ring -- baubles → game → actions → baubles -- so the bundle could run
 * `actions.ts` before `baubles.ts` had finished, and `ACTIONS` spread a
 * `BAUBLE_ACTIONS` that was not there yet. The page stopped on "Raising an
 * island…" with "is not iterable" in the console, for everybody, and nothing
 * in the suite noticed, because no test loads the built page. It is the same
 * race `items.ts` tells of for `TREASURE_ACTIONS`. (It imports the limits of
 * a settlement's notices and work from `noticeboard.ts`, which imports
 * nothing either, so no ring can close through it.)
 *
 * Ranks were a fixed ladder -- founder, mayor, builder, guest -- and each rule
 * asked "at least a builder?". They are the founder's own now: every
 * settlement has up to `RANK_CAP` of them besides its founder, named, in an
 * order the founder sets, and each a set of the powers in `RANK_POWERS`. A
 * rule asks for a power (`deedMay`), never for a name. Mayor, Builder and
 * Guest are what every settlement starts with (`DEFAULT_RANKS`), and are
 * edited like any other.
 *
 * The island keeps the same list in `rank_power` and `power_bit`, the same cap
 * in `rank_cap`, and the same three in `deed_ranks_seed`
 * (`20261013003000_ranks_of_your_own.sql`); `supabase/test/customranks.ts`
 * holds the two to each other.
 */
import { DELIVER_REACH, NOTICE_KEEP, NOTICE_MAX, WORK_COUNT_MAX, WORK_OPEN_MAX } from './noticeboard';

/**
 * What somebody is on a settlement: `founder` for whoever planted the stake,
 * or the name of their rank folded to lower case (`deed_member.role`).
 * Absent, in the game you play by yourself, means the founder.
 */
export type DeedRole = string;

/** The word for whoever planted the stake: never a rank, and the one name a rank may not have. */
export const FOUNDER = 'founder';

/** How many ranks a settlement may have besides its founder. The island's `rank_cap`. */
export const RANK_CAP = 8;

/** The longest a rank's name may be, in characters. The island's `rank_name_max`. */
export const RANK_NAME_MAX = 20;

/** One thing a rank may be allowed to do on its settlement. */
export interface RankPower {
  id: PowerId;
  /** Its bit in a rank's `perms`. Fixed for good: it is what the island has stored. */
  bit: number;
  /** What the Ranks section calls it. */
  label: string;
  /** After "you may": what holding it allows. */
  may: string;
  /** After "may not": what a refusal says is missing. */
  mayNot: string;
  /** The exact rule, for the toggle's tooltip and for Help. */
  rule: string;
}

export type PowerId = 'shape' | 'stores' | 'locks' | 'gate' | 'served' | 'set_bauble' | 'replace_bauble'
  | 'invite' | 'send_away' | 'set_ranks' | 'upgrade' | 'rename' | 'notices' | 'work' | 'keep_stores' | 'use_stores';

/**
 * How many takes and puts a settlement's store log keeps, newest first; an
 * older one goes as a new one comes. The island's `store_log_cap`
 * (`stores.ts`).
 */
export const STORE_LOG_CAP = 50;

/**
 * Every power a rank can be given, in the order the Ranks section lists them.
 *
 * Only what a rule on both sides now asks. Disbanding is not here: it frees
 * the founder's wildermon and tips out the founder's deed crate, which is
 * theirs and not the settlement's, so only the founder disbands. Planting and
 * harvesting are not either: nobody's rank was ever asked for those, and
 * tilling is shaping the ground.
 */
export const RANK_POWERS: readonly RankPower[] = [
  {
    id: 'shape', bit: 0, label: 'Shape and build',
    may: 'shape its ground and build on it', mayNot: 'shape its ground or build on it',
    rule: 'Dig, level, mine, till, pave, lay steps and dig springs and pools on its tiles; build and work on its buildings, bridges and aqueducts; clear its moss and ivy.',
  },
  {
    id: 'stores', bit: 1, label: 'Crates and stores',
    may: 'use the crates on it and craft from its stores', mayNot: 'use the crates on it that somebody else made',
    rule: 'Take from, put into and pick up the crates on it that somebody else made, and craft from them and from the chests and barrels on it. Crates you made are yours anywhere.',
  },
  {
    id: 'locks', bit: 2, label: 'Open its locks',
    may: 'open every lock on it without the key', mayNot: 'open its locks without the key',
    rule: 'Open every padlocked crate, chest, door, portcullis and drawbridge on it without holding the key, as its founder does.',
  },
  {
    id: 'gate', bit: 3, label: 'Rune gate',
    may: 'light its rune gates', mayNot: 'light its rune gates',
    rule: 'Its rune gates light when you stand in their opening. Lighting is all a rune gate does: anybody may walk through one.',
  },
  {
    id: 'served', bit: 4, label: 'Bauble effects',
    may: 'have its baubles work for you on it', mayNot: 'have its baubles work for them',
    rule: 'The baubles set in its altar apply to every action you do standing on it.',
  },
  {
    id: 'set_bauble', bit: 5, label: 'Set baubles',
    may: 'set baubles into its altar', mayNot: 'set baubles into its altar',
    rule: 'Set a restored bauble into an empty socket of its altar.',
  },
  {
    id: 'replace_bauble', bit: 6, label: 'Replace baubles',
    may: 'replace a bauble set in its altar', mayNot: 'replace a bauble already set in its altar',
    rule: 'Set a bauble into a socket that already holds one; the one it replaces is lost. Needs Set baubles as well.',
  },
  {
    id: 'invite', bit: 7, label: 'Invite',
    may: 'invite people to it', mayNot: 'invite anybody to it',
    rule: 'Ask anybody onto its member list, from the Social window or the right-click menu. They join at the rank for newcomers.',
  },
  {
    id: 'send_away', bit: 8, label: 'Send away',
    may: 'send away citizens of lower rank', mayNot: 'send anybody away',
    rule: 'Take a citizen off its member list, if their rank is below yours in the list.',
  },
  {
    id: 'set_ranks', bit: 9, label: 'Set ranks',
    may: 'give citizens of lower rank any lower rank', mayNot: "set anybody's rank",
    rule: 'Change the rank of a citizen whose rank is below yours, to a rank below yours.',
  },
  {
    id: 'upgrade', bit: 10, label: 'Upgrade',
    may: 'upgrade it', mayNot: 'upgrade it',
    rule: 'Take it up a level once everything the next level wants stands on it.',
  },
  {
    id: 'rename', bit: 11, label: 'Rename',
    may: 'rename it', mayNot: 'rename it',
    rule: 'Give it a new name.',
  },
  {
    id: 'notices', bit: 12, label: 'Post notices',
    may: 'post and take down its notices', mayNot: 'post or take down its notices',
    rule: `Post a notice of at most ${NOTICE_MAX} characters to its citizens, and take down any of its notices. It keeps the newest ${NOTICE_KEEP}; one more drops the oldest.`,
  },
  {
    id: 'work', bit: 13, label: 'Set work',
    may: 'set and take down the work it wants', mayNot: 'set or take down the work it wants',
    rule: `List work it wants: a kind of thing, how many (at most ${WORK_COUNT_MAX}) and a lowest quality if you like, up to ${WORK_OPEN_MAX} open at once; and take any of it down. Any citizen delivers toward it within ${DELIVER_REACH} tiles of its totem.`,
  },
  {
    id: 'keep_stores', bit: 14, label: 'Keep the settlement stores',
    may: 'mark its settlement stores and read their log', mayNot: 'mark its settlement stores or read their log',
    rule: `Mark a crate or a piece of storage furniture on it as a settlement store, or unmark one, from its Storage window; and read the store log, its last ${STORE_LOG_CAP} takes and puts, in the Settlement window.`,
  },
  {
    id: 'use_stores', bit: 15, label: 'Use the settlement stores',
    may: 'take from and put into its settlement stores', mayNot: 'use its settlement stores',
    rule: 'Take from and put into every settlement store on it, padlocked or not, without the key. Nobody but its founder and the ranks holding this opens one, key or not.',
  },
];

export const POWER: Record<PowerId, RankPower> = Object.fromEntries(RANK_POWERS.map((p) => [p.id, p])) as Record<PowerId, RankPower>;

/** A power's bit in a rank's `perms`: the island's `power_bit`. */
export const powerBit = (id: PowerId): number => 1 << POWER[id].bit;

/** A rank's `perms` for a list of powers. */
export const permsOf = (ids: readonly PowerId[]): number => ids.reduce((m, id) => m | powerBit(id), 0);

/** Every power at once: what the founder holds. */
export const ALL_PERMS = permsOf(RANK_POWERS.map((p) => p.id));

/**
 * What every settlement starts with, highest first, and what each may do:
 * exactly what mayors, builders and guests could do before ranks were the
 * founder's to make, so nothing changed for anybody the day they were --
 * and, since a settlement has notices and work, a Mayor posts the one and
 * sets the other, as the founder does.
 * The island's `deed_ranks_seed`.
 */
export const DEFAULT_RANKS: ReadonlyArray<{ name: string; powers: readonly PowerId[] }> = [
  { name: 'Mayor', powers: ['shape', 'stores', 'gate', 'served', 'set_bauble', 'replace_bauble', 'invite', 'send_away', 'set_ranks', 'notices', 'work'] },
  { name: 'Builder', powers: ['shape', 'stores', 'gate', 'served', 'set_bauble'] },
  { name: 'Guest', powers: ['stores'] },
];

/** The rank an invitation puts a newcomer on, until the founder chooses another. */
export const NEWCOMER_RANK = 'Builder';

/** One rank of a settlement, as the island lists them (`rpc_social`'s `defs`). */
export interface RankDef {
  id: number;
  name: string;
  /** Its place in the list: 1 is the highest. The founder is above them all. */
  ord: number;
  perms: number;
  /** Whether an invitation puts newcomers on it. One rank of each settlement is. */
  newcomer: boolean;
  /** How many citizens hold it. */
  held: number;
}

/** A settlement, as far as what you may do on it goes. */
export interface Ranked {
  name: string;
  /** `founder`, or your rank's name in lower case; absent in the game you play alone, where it is the founder. */
  role?: DeedRole | null;
  /** Your rank's name as the founder wrote it. */
  rank?: string | null;
  /** What your rank may do, as `perms`. Absent from an island from before custom ranks. */
  perms?: number | null;
}

/** Whether you planted the stake. Absent is the solo game, where you did. */
export const isFounder = (d: Pick<Ranked, 'role'>): boolean => (d.role ?? FOUNDER) === FOUNDER;

/**
 * What you may do on a settlement, as `perms`: everything for its founder,
 * what your rank holds otherwise. An island from before custom ranks sends
 * only the rank's name, and then it is what that name meant by default.
 */
export function permsHeld(d: Ranked): number {
  if (isFounder(d)) return ALL_PERMS;
  if (typeof d.perms === 'number') return d.perms;
  const was = DEFAULT_RANKS.find((r) => r.name.toLowerCase() === (d.role ?? '').toLowerCase());
  return was ? permsOf(was.powers) : 0;
}

/** Whether you may do this on a settlement of yours. No settlement, no. */
export const deedMay = (d: Ranked | null | undefined, p: PowerId): boolean => !!d && (permsHeld(d) & powerBit(p)) !== 0;

/** Your rank's name on a settlement, as the founder wrote it. */
export const rankName = (d: Ranked): string => (isFounder(d) ? 'Founder' : d.rank ?? title(d.role ?? ''));

const title = (r: string): string => r.charAt(0).toUpperCase() + r.slice(1);

export const andList = (xs: readonly string[]): string =>
  (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * What a rank lets you do, after "you may": every power it holds, in the list's
 * order. The island's `rank_may`, word for word.
 */
export const rankMay = (perms: number): string => {
  const held = RANK_POWERS.filter((p) => (perms & powerBit(p.id)) !== 0).map((p) => p.may);
  return held.length ? andList(held) : 'walk it and do nothing else there';
};

/**
 * Why your rank stops you: the one sentence every refusal of a power says,
 * on both sides. The island's `rank_lacks`.
 */
export const lacksSaid = (deed: string, rank: string, p: PowerId): string =>
  `Your rank at ${deed} (${rank}) cannot ${POWER[p].mayNot}.`;

/** The refusal for this power on this settlement of yours, or null when your rank holds it. */
export const lacks = (d: Ranked | null | undefined, p: PowerId): string | null =>
  !d || deedMay(d, p) ? null : lacksSaid(d.name, rankName(d), p);

/* ---- naming, ordering and deleting a rank: the founder's -------------------- */

/** Why a name will not do for a rank of this settlement, or null. `except` is the rank being renamed. */
export function rankNameRefusal(deed: string, defs: readonly RankDef[], name: string, except?: number): string | null {
  const n = name.trim();
  if (!n) return 'Name the rank.';
  if (n.length > RANK_NAME_MAX) return `Rank name: max ${RANK_NAME_MAX} characters.`;
  if (n.toLowerCase() === FOUNDER) return 'Founder is not a rank name.';
  if (defs.some((r) => r.id !== except && r.name.toLowerCase() === n.toLowerCase())) return `${deed} already has a rank named ${n}.`;
  return null;
}

/** Why a new rank will not be made, or null. The island's `rpc_rank_add`. */
export function rankAddRefusal(deed: string, defs: readonly RankDef[], name: string): string | null {
  if (defs.length >= RANK_CAP) return `${deed}: max ${RANK_CAP} ranks besides the founder.`;
  return rankNameRefusal(deed, defs, name);
}

/** Why a rank will not move a place up (-1) or down (1) the list, or null. `rpc_rank_move`. */
export function rankMoveRefusal(defs: readonly RankDef[], id: number, dir: number): string | null {
  const sorted = [...defs].sort((a, b) => a.ord - b.ord);
  const at = sorted.findIndex((r) => r.id === id);
  if (at < 0) return 'That rank is gone.';
  if (dir < 0 && at === 0) return `${sorted[at].name}: already the highest rank.`;
  if (dir > 0 && at === sorted.length - 1) return `${sorted[at].name}: already the lowest rank.`;
  return null;
}

/**
 * Why a rank will not be deleted, or null. `rpc_rank_drop`. Nobody is moved
 * to another rank behind the founder's back: a rank somebody holds stays
 * until they hold another.
 */
export function rankDropRefusal(defs: readonly RankDef[], id: number): string | null {
  const r = defs.find((e) => e.id === id);
  if (!r) return 'That rank is gone.';
  if (r.newcomer) return `${r.name} is the newcomer rank: choose another first.`;
  if (r.held > 0) return `${r.name} held by ${r.held} ${r.held === 1 ? 'citizen' : 'citizens'}: give them another rank first.`;
  return null;
}
