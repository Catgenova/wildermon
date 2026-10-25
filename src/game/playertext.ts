/**
 * Text a player writes for others to read: talk, letters, notices, names of
 * things, settlements, buildings, wildermon, ranks, a memorial's line and a
 * signature.
 *
 * The island cleans every one of them with `private.clean_text` and refuses a
 * name that reads as a keeper or as staff with `private.name_refusal`. This is
 * the same rule, so that the menu refuses before anything is sent and says it
 * in the island's words. `supabase/test/playertext.ts` holds the two to each
 * other on a list of nasty strings.
 *
 * Cleaning, in order:
 *   * control characters, zero-width and invisible characters, bidi overrides
 *     and isolates, and tag characters are removed (`STRIP`);
 *   * every other kind of space or line break becomes one space, runs of
 *     spaces become one, and the ends are trimmed (`SPACE`);
 *   * NFC;
 *   * cut at `max` code points (as Postgres's `left` counts).
 *
 * A name poses as staff when, folded (`nameFold`), a word of it, or all of it
 * run together, begins with one of `STAFF_WORDS`; or when all of it run
 * together is a keeper's name run together. Keepers themselves are not asked.
 */

/** Removed outright: C0 and C1 controls but the spaces, soft hyphen, joiners, marks, bidi, fillers, BOM, tags. */
const STRIP = /[\u0000-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F\u00AD\u034F\u061C\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\uFFF9-\uFFFB]|[\u{E0000}-\u{E007F}]|\p{Cs}/gu;
/** One space each: tab, line breaks, and every Unicode space. */
const SPACE = /[\u0009-\u000D \u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g;
/** Combining marks, dropped after NFKD when folding. */
const MARKS = /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g;

/** Letters that look like Latin ones, and the Latin letter each reads as: Cyrillic, Greek, small capitals. */
export const CONFUSABLE_FROM = '\u0410\u0412\u0415\u0417\u041A\u041C\u041D\u041E\u0420\u0421\u0422\u0423\u0425\u0406\u0408\u0405\u0430\u0435\u043E\u0440\u0441\u0443\u0445\u0456\u0458\u0455\u04BB\u0501\u051B\u051D\u04CF\u0261\u043A\u043C\u0442\u0432\u043D\u0391\u0392\u0395\u0396\u0397\u0399\u039A\u039C\u039D\u039F\u03A1\u03A4\u03A5\u03A7\u03B1\u03B5\u03B9\u03BA\u03BD\u03BF\u03C1\u03C4\u03C5\u03C7\u0131\u0251\u1D00\u0299\u1D04\u1D05\u1D07\u0262\u029C\u026A\u1D0A\u1D0B\u029F\u1D0D\u0274\u1D0F\u1D18\u0280\uA731\u1D1B\u1D1C\u1D20\u1D21\u028F\u1D22';
export const CONFUSABLE_TO = 'ABE3KMHOPCTYXIJSaeopcyxijshdqwlgkmtbhABEZHIKMNOPTYXaeikvoptuxiaabcdeghijklmnoprstuvwyz';
/** Digits and signs read as letters, after folding to lower case; `i` and `l` are one letter here. */
const LEET_FROM = '0123456789@$|!i';
const LEET_TO = 'olzeasbtbgaslll';

/** The words a name may not begin with, unfolded. */
export const STAFF_WORDS = ['keeper', 'admin', 'moderator', 'system'] as const;

/** The refusal, the island's `private.name_reserved_said()`. */
export const NAME_RESERVED = 'Reserved name: keepers and staff.';

/** The actions whose asked text is a name, the island's `private.names_asked()`. */
export const NAMES_ASKED = ['name_thing', 'plan_building', 'rename_building', 'rename_creature', 'found_settlement', 'rename_deed'] as const;

const codePoints = (s: string): string[] => Array.from(s);

const translate = (s: string, from: string, to: string): string => {
  const f = codePoints(from);
  const t = codePoints(to);
  const map = new Map<string, string>();
  f.forEach((c, i) => { if (!map.has(c)) map.set(c, t[i] ?? ''); });
  return codePoints(s).map((c) => map.get(c) ?? c).join('');
};

/** Text as the island keeps it: see the head of this file. `max` in code points; omitted, no cut. */
export function cleanText(raw: string | null | undefined, max?: number): string {
  const s = String(raw ?? '').replace(STRIP, '').replace(SPACE, ' ').replace(/ {2,}/g, ' ').replace(/^ +| +$/g, '').normalize('NFC');
  return max === undefined ? s : codePoints(s).slice(0, Math.max(0, max)).join('');
}

/** A name folded for comparison: confusables to Latin, lower case, digits read as letters, words split, single letters run together. */
export function nameFold(raw: string | null | undefined): string {
  let s = cleanText(raw, 200);
  s = s.normalize('NFKD').replace(MARKS, '');
  s = translate(s, CONFUSABLE_FROM, CONFUSABLE_TO);
  s = s.replace(/([a-z])(?=[A-Z])/g, '$1 ');
  s = s.replace(/[A-Z]/g, (c) => c.toLowerCase());
  s = translate(s, LEET_FROM, LEET_TO);
  s = s.replace(/rn/g, 'm').replace(/vv/g, 'w');
  s = s.replace(/[^a-z]+/g, ' ').replace(/^ +| +$/g, '');
  if (!s) return '';
  const out: string[] = [];
  let run = '';
  for (const w of s.split(' ')) {
    if (w.length === 1) { run += w; continue; }
    if (run) { out.push(run); run = ''; }
    out.push(w);
  }
  if (run) out.push(run);
  return out.join(' ');
}

/** Whether a name reads as staff: a word of it, or all of it run together, begins with one of `STAFF_WORDS`. */
export function namePoses(raw: string | null | undefined): boolean {
  const f = nameFold(raw);
  if (!f) return false;
  const words = [...f.split(' '), f.replace(/ /g, '')];
  const staff = STAFF_WORDS.map((w) => nameFold(w));
  return words.some((w) => staff.some((s) => w.startsWith(s)));
}

/**
 * Why this name will not be taken, or null: `NAME_RESERVED` when it poses as
 * staff or is, run together and folded, one of `keepers`' names. A keeper
 * naming something is not asked (`keeper`).
 */
export function nameRefusal(raw: string | null | undefined, keepers: readonly string[] = [], keeper = false): string | null {
  if (keeper) return null;
  if (namePoses(raw)) return NAME_RESERVED;
  const f = nameFold(raw).replace(/ /g, '');
  if (f && keepers.some((k) => nameFold(k).replace(/ /g, '') === f)) return NAME_RESERVED;
  return null;
}
