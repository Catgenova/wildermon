/**
 * An island's keepers, and what the Island keeper window says.
 *
 * Who keeps an island is the island's to say (`rpc_owner_am_i`): anybody the
 * deploy made an owner of every island on the project, and whoever founded
 * this one. Only they are shown any of this. The lines are here, apart from
 * the window, so they can be read and held against the island's answers
 * without a page to draw them on.
 */
import { awayFor } from './away';

/** How often the window asks again who is on the island, while it is open, in seconds. */
export const KEEPER_REFRESH = 30;

/**
 * How long a keeper may mute somebody for, in seconds, shortest first; `null`
 * is until a keeper lifts it. The island takes any number of seconds; these are
 * the ones offered.
 */
export const MUTE_FOR: ReadonlyArray<number | null> = [60 * 60, 24 * 60 * 60, null];

/** What a mute shuts, which the island's refusal names in the same three. */
export const MUTE_SHUTS = 'what they say aloud, write in a letter or put in a parcel note';

/**
 * What every keeper door but `rpc_owner_am_i` refuses with when the account has
 * a verified authenticator (two-step sign-in) and this session has not given
 * its code. The island raises the same words (`private.keeper_code_ok`).
 */
export const KEEPER_CODE = 'Authenticator code needed: Island keeper window.';
/** Digits in an authenticator code, and the seconds each lasts, in Supabase Auth's TOTP. */
export const CODE_DIGITS = 6;
export const CODE_SECONDS = 30;

/** One body on the island, as `rpc_owner_online` sends it. */
export interface KeptBody {
  uid: string;
  name: string;
  /** The tile they stand on. */
  x: number;
  y: number;
  away: boolean;
  /** Seconds since the island last heard from them. */
  heard: number;
  muted: boolean;
  /** Seconds of the mute left; null while it lasts until a keeper lifts it, or when there is none. */
  muted_for: number | null;
  /** Whether every door of the island refuses them (`rpc_owner_kick`). */
  barred: boolean;
  /** Seconds of the bar left; null while it lasts until a keeper lifts it, or when there is none. */
  barred_for: number | null;
  /** The token of the settlement they founded, which Move puts them on. */
  home: { x: number; y: number; name: string } | null;
  /** Whether they keep this island too. */
  keeper: boolean;
  /** Whether this is the one asking. */
  you: boolean;
}

/** Everybody with a body on the island, and where newcomers come ashore. */
export interface Kept {
  people: KeptBody[];
  spawn: { x: number; y: number };
}

/** A mute's menu row: "For 1 hour", "Until lifted". */
export const muteLabel = (secs: number | null): string => (secs === null ? 'Until lifted' : `For ${awayFor(secs)}`);

/** What a mute of that length does, for the note under its row. */
export const muteNote = (secs: number | null): string =>
  secs === null ? 'Until you or another keeper lifts it' : `Lifts after ${awayFor(secs)}`;

/** How long ago the island last heard from somebody. */
export const heardLine = (secs: number): string =>
  secs < 60 ? 'heard from just now' : `heard from ${awayFor(secs)} ago`;

/**
 * The mute on somebody, as their row says it; empty when there is none. `until`
 * says when that many seconds from now is, on this machine's clock.
 */
export const muteLine = (b: KeptBody, until?: (secs: number) => string): string => {
  if (!b.muted) return '';
  if (b.muted_for === null) return 'muted until lifted';
  return `muted for ${awayFor(b.muted_for)} more${until ? `, until ${until(b.muted_for)}` : ''}`;
};

/** Where Move puts somebody, in the island's words for it. */
export const moveTarget = (b: KeptBody, spawn: Kept['spawn']): string =>
  b.home ? `the totem of ${b.home.name} at (${b.home.x}, ${b.home.y})` : `where newcomers come ashore, at (${spawn.x}, ${spawn.y})`;

/** Everything Move does, for the button's title. */
export const moveHint = (b: KeptBody, spawn: Kept['spawn']): string =>
  `Put ${b.you ? 'yourself' : b.name} on ${moveTarget(b, spawn)}, stop what ${b.you ? 'you are' : 'they are'} doing, `
  + `empty ${b.you ? 'your' : 'their'} queue, and take ${b.you ? 'you' : 'them'} off anything ridden, driven, pulled or boarded.`;

/** What clearing a pile deletes, for the question asked before it goes. */
export const clearQuestion = (x: number, y: number, stacks: number, things: number): string =>
  `Delete everything lying on the ground at (${x}, ${y}): ${things} ${things === 1 ? 'thing' : 'things'} in `
  + `${stacks} ${stacks === 1 ? 'stack' : 'stacks'}, and whatever is inside them? Nobody can get it back.`;

/**
 * How long a keeper may bar somebody for, in seconds, shortest first: 0 logs
 * them off and bars nothing, `null` bars until a keeper lifts it. The island
 * takes any number of seconds; these are the ones offered.
 */
export const BAR_FOR: ReadonlyArray<number | null> = [0, 60 * 60, 24 * 60 * 60, null];

/** What a kick does, for the button's title and the Actions note. */
export const KICK_DOES = 'logs them off now: away, action stopped, queue emptied, off anything ridden, driven, pulled or boarded';

/** What a bar shuts, which the island's refusal names. */
export const BAR_SHUTS = 'every door of this island: joining, moving, acting, talking';

/** How every door's refusal of a barred body begins (`private.barred_why`). */
export const BARRED_SAYS = 'Barred from this island';

/** Whether a door's refusal is a bar's. */
export const isBarred = (why: string | null | undefined): boolean => !!why && why.startsWith(BARRED_SAYS);

/** A kick's menu row: "Log off only", "Bar for 1 hour", "Bar until lifted". */
export const barLabel = (secs: number | null): string =>
  secs === 0 ? 'Log off only' : secs === null ? 'Bar until lifted' : `Bar for ${awayFor(secs)}`;

/** What a kick of that length does, for the note under its row. */
export const barNote = (secs: number | null): string =>
  secs === 0 ? 'May come back at once' : secs === null ? 'Until you or another keeper lifts it' : `Lifts after ${awayFor(secs)}`;

/** The bar on somebody, as their row says it; empty when there is none. */
export const barLine = (b: KeptBody, until?: (secs: number) => string): string => {
  if (!b.barred) return '';
  if (b.barred_for === null) return 'barred until lifted';
  return `barred for ${awayFor(b.barred_for)} more${until ? `, until ${until(b.barred_for)}` : ''}`;
};

/**
 * Why somebody may report somebody else, in the order the menu offers them.
 * The island takes these ids and no others (`private.report_reasons`).
 */
export const REPORT_REASONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'cheating', label: 'Cheating' },
  { id: 'abuse', label: 'Abuse in chat' },
  { id: 'griefing', label: 'Griefing' },
  { id: 'other', label: 'Other' },
];

/** The most characters a report's note keeps (`private.report_note_max`). */
export const REPORT_NOTE_MAX = 200;
/** Reports one body may send on an island in any 24 hours (`private.reports_a_day`). */
export const REPORTS_A_DAY = 5;
/** Reports one body may send about the same person in any 24 hours, as `rpc_report_player` holds it. */
export const REPORTS_PER_PERSON = 1;
/** Days a report is kept after a keeper marks it handled; an open one is kept `REPORT_OPEN_DAYS` (`private.report_kept_days`). */
export const REPORT_HANDLED_DAYS = 30;
export const REPORT_OPEN_DAYS = 90;

/** A reason's label, from its id. */
export const reportReason = (id: string): string => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

/** One open report, as `rpc_owner_reports` sends it. */
export interface KeptReport {
  n: number;
  /** Seconds since it was sent. */
  ago: number;
  by: { uid: string; name: string };
  whom: { uid: string; name: string };
  reason: string;
  note: string | null;
  /** Open reports against the same body, this one included. */
  against: number;
}

/** New characters one connection may make across the project in 24 hours. The island's `private.ip_body_cap`. */
export const NEW_BODIES_A_DAY = 3;
