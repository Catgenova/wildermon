/**
 * Player text, the same on both sides (`src/game/playertext.ts`, `private.clean_text` and the rest).
 *
 *   * a list of nasty strings -- an RTL override, zero-width characters, a homoglyph Keeper (a Cyrillic e), a 500-character
 *     name, a newline injection, `<script>`, fullwidth and small capitals, isolates and tag characters -- cleaned,
 *     folded and judged the same in the browser and on the island, at a cut and with none;
 *   * the refusal's words, the staff words and the actions whose asked text is a name, the same on both sides;
 *   * through the doors, on an island of its own (Textrock, kept by Nimbus): talk, a letter and a notice kept
 *     cleaned; a crate named through `rpc_act` cleaned, refused as a keeper by a homoglyph and by a keeper's own name,
 *     and not refused to the keeper; a wildermon's name cut at its length; a rank refused as staff and cleaned; a
 *     body joining as Moderator kept as Wanderer; an island founded as System refused; and an account name that
 *     poses as staff neither free nor taken up.
 *
 * Rolls everything back.
 *
 *   npx esbuild supabase/test/playertext.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/playertext.mjs && node node_modules/.cache/playertext.mjs
 */
import { execFileSync } from 'node:child_process';
import '../../src/game/game';
import {
  cleanText, CONFUSABLE_FROM, NAME_RESERVED, nameFold, namePoses, nameRefusal, NAMES_ASKED, STAFF_WORDS,
} from '../../src/game/playertext';
import { cleanSaid, SAY_MAX } from '../../src/game/chat';
import { cleanEngraving, ENGRAVE_MAX } from '../../src/game/memorial';
import { cleanSignature, SIGN_MAX } from '../../src/game/signing';
import { cleanNotice } from '../../src/game/noticeboard';
import { RANK_NAME_MAX, rankNameRefusal } from '../../src/game/ranks';
import { NAME_MAX } from '../../src/game/naming';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
      PGCLIENTENCODING: 'UTF8',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
/** A string as a SQL literal, whatever is in it. */
const sq = (s: string): string => `'${s.replace(/'/g, "''")}'`;
/** A list of strings as a jsonb literal: JSON escapes the controls, Postgres takes the rest as it is. */
const jl = (xs: readonly string[]): string => `${sq(JSON.stringify(xs))}::jsonb`;

const NIMBUS = '7e470000-0000-4000-8000-00000000000a'; // keeps Textrock
const ANNA = '7e470000-0000-4000-8000-00000000000b';
const BERT = '7e470000-0000-4000-8000-00000000000c'; // joins as Moderator
const POSER = '7e470000-0000-4000-8000-00000000000d'; // signs up as adm1n
const KEEPERS = ['nimbus', 'Nimbus'];

const NASTY = [
  'Hello\u202Eevil\u202C', // RTL override
  'zero\u200Bwidth\u200C\u200D\uFEFF\u2060name', // zero-width
  'K\u0435eper', // Cyrillic \u0435
  'x'.repeat(500),
  'line one\nline two\r\n\tthree\u2028four', // newline injection
  '<script>alert(1)</script>',
  '  lots   of\u00A0\u3000spaces  ',
  'e\u0301te cafe\u0301', // NFC
  '\uFF21\uFF44\uFF4D\uFF49\uFF4E', // fullwidth Admin
  '\u1D0B\u1D07\u1D07\u1D18\u1D07\u0280', // small capitals keeper
  'k e e p e r', 'k.e.e.p.e.r', 'Adm1n', 'MODERATOR', 'TheKeeper', 'sys_tem', 'S\u00A5stem', 'k\u00E9\u00EBp\u00E9r', '$y$tem', 'm0derat0r',
  'Beekeeper', 'Hearthkeeper', 'Bob', 'Mod squad', 'Systematic', 'Administration', 'Keepsake',
  '\u2066isolate\u2069d', 'tag\u{E0041}\u{E0042}s', 'ctrl\u0001\u0007\u001B[31m\u007F\u0085\u009Bchars',
  'family \u{1F468}\u200D\u{1F469}\u200D\u{1F467}', '\u3164\u115F\u1160', 'soft\u00ADhyphen', 'N1mbus', 'n i m b u s', 'Nimbuses',
  CONFUSABLE_FROM, ' ', '', '\u03A9\u2248\u00E7\u221A\u222B \u4E2D\u6587 \u0627\u0644\u0639\u0631\u0628\u064A\u0629',
];
const CUTS = [NAME_MAX, 24, 1];

/* ---- the rule, on both sides ---------------------------------------------------------- */

const raw = psql(`
select json_build_object(
  'clean', (select json_agg(private.clean_text(t) order by o) from jsonb_array_elements_text(${jl(NASTY)}) with ordinality u(t, o)),
  'cut', (select json_agg(json_build_array(${CUTS.map((c) => `private.clean_text(t, ${c})`).join(', ')}) order by o)
            from jsonb_array_elements_text(${jl(NASTY)}) with ordinality u(t, o)),
  'fold', (select json_agg(private.name_fold(t) order by o) from jsonb_array_elements_text(${jl(NASTY)}) with ordinality u(t, o)),
  'poses', (select json_agg(private.name_poses(t) order by o) from jsonb_array_elements_text(${jl(NASTY)}) with ordinality u(t, o)),
  'memorial', (select json_agg(memorial_clean(t) order by o) from jsonb_array_elements_text(${jl(NASTY)}) with ordinality u(t, o)),
  'sign', (select json_agg(sign_clean(t) order by o) from jsonb_array_elements_text(${jl(NASTY)}) with ordinality u(t, o)),
  'nulls', json_build_array(private.clean_text(null), private.clean_text(null, 4), private.name_fold(null), private.name_poses(null)),
  'said', private.name_reserved_said(),
  'staff', private.staff_words(),
  'asked', private.names_asked(),
  'engrave', engrave_max(), 'signmax', sign_max(), 'say', say_max(), 'rank', rank_name_max()
)`);
const isle = JSON.parse(raw) as {
  clean: string[]; cut: string[][]; fold: string[]; poses: boolean[]; memorial: string[]; sign: string[];
  nulls: [string, string, string, boolean]; said: string; staff: string[]; asked: string[];
  engrave: number; signmax: number; say: number; rank: number;
};

const differ = (a: readonly unknown[], b: readonly unknown[]): string =>
  a.map((x, i) => (JSON.stringify(x) === JSON.stringify(b[i]) ? '' : `#${i} ${JSON.stringify(NASTY[i]).slice(0, 40)}: here ${JSON.stringify(x).slice(0, 60)}, island ${JSON.stringify(b[i]).slice(0, 60)}`))
    .filter(Boolean).join('; ');

check('the lengths the browser cuts at are the island\'s', isle.engrave === ENGRAVE_MAX && isle.signmax === SIGN_MAX
  && isle.say === SAY_MAX && isle.rank === RANK_NAME_MAX, `${isle.engrave}, ${isle.signmax}, ${isle.say}, ${isle.rank}`);
{
  const here = NASTY.map((s) => cleanText(s));
  check('every nasty string is cleaned the same on both sides, uncut', differ(here, isle.clean) === '', differ(here, isle.clean));
  const cut = NASTY.map((s) => CUTS.map((c) => cleanText(s, c)));
  check(`and cut at ${CUTS.join(', ')} code points`, differ(cut, isle.cut) === '', differ(cut, isle.cut));
  const fold = NASTY.map(nameFold);
  check('and folded the same, for comparing names', differ(fold, isle.fold) === '', differ(fold, isle.fold));
  const poses = NASTY.map(namePoses);
  check('and judged the same: posing as staff or not', differ(poses, isle.poses) === '', differ(poses, isle.poses));
  const mem = NASTY.map(cleanEngraving);
  check('a memorial\'s line is cleaned the same on both sides', differ(mem, isle.memorial) === '', differ(mem, isle.memorial));
  const sig = NASTY.map(cleanSignature);
  check('and a signature', differ(sig, isle.sign) === '', differ(sig, isle.sign));
  check('nothing at all cleans to nothing and poses as nobody',
    JSON.stringify(isle.nulls) === JSON.stringify([cleanText(null), cleanText(null, 4), nameFold(null), namePoses(null)]), JSON.stringify(isle.nulls));
}
check('the refusal is in the same words on both sides', isle.said === NAME_RESERVED, isle.said);
check('the same staff words', JSON.stringify(isle.staff) === JSON.stringify(STAFF_WORDS), isle.staff.join(','));
check('the same actions ask for a name', JSON.stringify(isle.asked) === JSON.stringify(NAMES_ASKED), isle.asked.join(','));

/* What the cleaning does, said once each so that a change to it is a change to this test. */
const c = (s: string): string => cleanText(s);
check('an RTL override is taken out', c(NASTY[0]) === 'Helloevil');
check('zero-width characters are taken out', c(NASTY[1]) === 'zerowidthname');
check('a homoglyph K\u0435eper is refused as a keeper', nameRefusal(NASTY[2]) === NAME_RESERVED && nameFold(NASTY[2]) === 'keeper');
check('a 500-character name is cut at a name\'s length', [...cleanText(NASTY[3], NAME_MAX)].length === NAME_MAX);
check('a newline becomes a space, not a second line', c(NASTY[4]) === 'line one line two three four');
check('<script> is kept as the words it is (drawn as text, never as markup)', c(NASTY[5]) === NASTY[5] && !namePoses(NASTY[5]));
check('every kind of space is one space, and the ends are trimmed', c(NASTY[6]) === 'lots of spaces');
check('NFC: a letter and its accent are one letter', c(NASTY[7]) === '\u00E9te caf\u00E9');
check('C0 and C1 controls are taken out', c('ctrl\u0001\u0007\u001B[31m\u007F\u0085\u009Bchars') === 'ctrl[31m chars');
check('isolates and tag characters are taken out', c('\u2066isolate\u2069d') === 'isolated' && c('tag\u{E0041}\u{E0042}s') === 'tags');
check('a name of fillers is no name', c('\u3164\u115F\u1160') === '');
check('trimmed, then cut, as talk always was', cleanText(' ab cd', 3) === 'ab ');
{
  const refused = ['K\u0435eper', '\uFF21\uFF44\uFF4D\uFF49\uFF4E', '\u1D0B\u1D07\u1D07\u1D18\u1D07\u0280', 'k e e p e r', 'k.e.e.p.e.r',
    'Adm1n', 'MODERATOR', 'TheKeeper', 'sys_tem', 'k\u00E9\u00EBp\u00E9r', '$y$tem', 'm0derat0r', 'Systematic', 'Administration'];
  const allowed = ['Beekeeper', 'Hearthkeeper', 'Bob', 'Mod squad', 'Keepsake', '<script>alert(1)</script>', '\u03A9\u2248\u00E7\u221A\u222B \u4E2D\u6587 \u0627\u0644\u0639\u0631\u0628\u064A\u0629'];
  const wrongly = [...refused.filter((s) => nameRefusal(s) !== NAME_RESERVED), ...allowed.filter((s) => nameRefusal(s) !== null)];
  check('a word beginning keeper, admin, moderator or system is refused, however it is spelt; a word ending in one is not',
    wrongly.length === 0, wrongly.join(', '));
  check('a keeper\'s name, folded, is refused; the keeper is not asked',
    nameRefusal('N1mbus', KEEPERS) === NAME_RESERVED && nameRefusal('n i m b u s', KEEPERS) === NAME_RESERVED
      && nameRefusal('Nimbuses', KEEPERS) === null && nameRefusal('N1mbus', KEEPERS, true) === null && nameRefusal('Keeper', [], true) === null);
}
check('talk is cleaned by the same rule, at its own length', NASTY.every((s) => cleanSaid(s) === cleanText(s, SAY_MAX)));
check('a notice is cleaned by the same rule', NASTY.every((s) => cleanNotice(s) === cleanText(s)));
check('a rank is refused as staff in the same words, and named after cleaning',
  rankNameRefusal('Textstead', [], 'Adm1n') === NAME_RESERVED && rankNameRefusal('Textstead', [], 'Ward\u200Ben') === null
    && rankNameRefusal('Textstead', [], '\u200B\u200B') === 'Name the rank.');

/* ---- through the doors ------------------------------------------------------------------ */

const DOMAIN = '@catgenova.github.io';
const doors = psql(`
discard temp;
begin;
create temp table said (k text, v text);
grant all on said to anon, authenticated;
do $t$
declare w uuid; r jsonb; v_why text; v_n int;
begin
  insert into auth.users (id, email) values ('${NIMBUS}', 'nimbus${DOMAIN}'), ('${ANNA}', 'textanna${DOMAIN}'),
    ('${BERT}', 'textbert${DOMAIN}'), ('${POSER}', 'adm1n${DOMAIN}') on conflict do nothing;
  insert into account (uid, name, display) values ('${NIMBUS}', 'nimbus', 'Nimbus'), ('${ANNA}', 'textanna', null),
    ('${BERT}', 'textbert', null) on conflict do nothing;
  insert into world (name, seed, size, spawn_x, spawn_y, ready, made_by) values ('Textrock', 471, 40, 16, 16, true, '${NIMBUS}')
    returning id into w;
  perform land_blank(w, 40);
  perform set_config('my.w', w::text, false);

  perform set_config('request.jwt.claims', json_build_object('sub', '${NIMBUS}')::text, true);
  perform rpc_join(w, 'Nimbus');
  perform set_config('request.jwt.claims', json_build_object('sub', '${BERT}')::text, true);
  perform rpc_join(w, 'Moderator');
  insert into said select 'JOIN_POSER', name from player where world_id = w and uid = '${BERT}';
  perform rpc_join(w, 'N1mbus');
  insert into said select 'JOIN_KEEPERS', name from player where world_id = w and uid = '${BERT}';
  perform rpc_join(w, E'Bert\\u202E\\u200B the\\nlong-named one of Textrock');
  insert into said select 'JOIN_CLEAN', name from player where world_id = w and uid = '${BERT}';

  perform set_config('request.jwt.claims', json_build_object('sub', '${ANNA}')::text, true);
  perform rpc_join(w, 'Anna');
  r := rpc_say(w, ${sq(NASTY[0] + ' ' + NASTY[1] + '\n' + NASTY[4])});
  insert into said values ('SAY', r->>'said');
  insert into said select 'SAY_KEPT', text from event where world_id = w and kind = 'chat' order by n desc limit 1;
  r := rpc_letter(w, '${NIMBUS}', ${sq(NASTY[4] + '\u202E')});
  insert into said values ('LETTER', r->>'sent');
  insert into said select 'LETTER_KEPT', text from letter where world_id = w and sender = '${ANNA}' order by n desc limit 1;

  -- A crate at Anna's feet, named three ways.
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by) values (w, 4701, 'plank', 16, 16, 0, 0, '${ANNA}');
  r := rpc_act(w, 'name_thing', jsonb_build_object('kind', 'crate', 'id', 4701, 'name', ${sq(NASTY[2])}));
  insert into said values ('CRATE_HOMOGLYPH', coalesce(r->>'why', 'ALLOWED'));
  r := rpc_act(w, 'name_thing', jsonb_build_object('kind', 'crate', 'id', 4701, 'name', 'N1mbus'));
  insert into said values ('CRATE_KEEPERNAME', coalesce(r->>'why', 'ALLOWED'));
  insert into said select 'CRATE_UNNAMED', coalesce(name, 'NONE') from crate where world_id = w and id = 4701;
  r := rpc_act(w, 'name_thing', jsonb_build_object('kind', 'crate', 'id', 4701, 'name', ${sq('Bee\u200Bkeeper\u202E stores\n and more and more and more')}));
  insert into said values ('CRATE_CLEAN_WHY', coalesce(r->>'why', 'ALLOWED'));
  insert into said select 'CRATE_CLEAN', coalesce(name, 'NONE') from crate where world_id = w and id = 4701;
  -- The keeper may call a thing what it likes.
  perform set_config('request.jwt.claims', json_build_object('sub', '${NIMBUS}')::text, true);
  update player set x = 16.5, y = 16.5 where world_id = w and uid = '${NIMBUS}';
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by) values (w, 4702, 'plank', 16, 16, 0, 0, '${NIMBUS}');
  r := rpc_act(w, 'name_thing', jsonb_build_object('kind', 'crate', 'id', 4702, 'name', 'Keeper''s'));
  insert into said values ('CRATE_KEEPER', coalesce(r->>'why', 'ALLOWED'));
  insert into said select 'CRATE_KEEPER_NAME', coalesce(name, 'NONE') from crate where world_id = w and id = 4702;
  perform set_config('request.jwt.claims', json_build_object('sub', '${ANNA}')::text, true);

  -- A wildermon of Anna's: renamed past its length, and as an admin.
  v_n := creature_spawn(w, 'holla', 16.5, 16.5, 'deed', now() - interval '60 days', '${ANNA}');
  insert into said values ('BEAST_STAFF', coalesce(act_refusal(w, '${ANNA}', 'rename_creature',
    jsonb_build_object('kind', 'creature', 'id', v_n, 'name', 'Adm1n')), 'ALLOWED'));
  perform perform_creature(w, '${ANNA}', 'rename_creature', jsonb_build_object('kind', 'creature', 'id', v_n, 'name', ${sq(NASTY[3])}));
  insert into said select 'BEAST_LONG', length(name)::text from creature where world_id = w and id = v_n;

  -- A settlement of Anna's, and its ranks.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Textstead', 30, 30, 2, 1, '${ANNA}');
  insert into said values ('SETTLE_STAFF', coalesce(act_refusal(w, '${ANNA}', 'rename_deed',
    jsonb_build_object('kind', 'deed', 'name', 'The System')), 'ALLOWED'));
  r := rpc_rank_add(w, 'Adm1n');
  insert into said values ('RANK_STAFF', coalesce(r->>'why', 'ALLOWED'));
  r := rpc_rank_add(w, E'Ward\\u200Ben\\u202E');
  insert into said values ('RANK_CLEAN', coalesce(r->>'added', r->>'why'));
  r := rpc_notice_post(w, '${ANNA}', ${sq('Meet\u200B at\n\n the\u202E well')});
  insert into said values ('NOTICE_WHY', coalesce(r->>'why', 'ALLOWED'));
  insert into said select 'NOTICE', body from deed_notice where world_id = w and founder = '${ANNA}' order by n desc limit 1;

  -- An island called System, by somebody who keeps none.
  begin
    perform rpc_found(E'Sys\\u200Btem isle', 9, 40, 16, 16);
    insert into said values ('FOUND', 'ALLOWED');
  exception when others then
    insert into said values ('FOUND', sqlerrm);
  end;
  insert into said select 'FOUND_ROW', count(*)::text from world where name like 'Sys%';

  -- Account names: a free one and one that poses, asked and taken up.
  insert into said values ('FREE_STAFF', rpc_name_free('adm1n')::text), ('FREE_OK', rpc_name_free('beekeeper')::text);
  perform set_config('request.jwt.claims', json_build_object('sub', '${POSER}')::text, true);
  insert into said values ('MYNAME_STAFF', coalesce(rpc_my_name(), 'NONE'));
  insert into said select 'MYNAME_ROW', count(*)::text from account where uid = '${POSER}';
end $t$;
select json_object_agg(k, v) from said;
rollback;
`);
const got = JSON.parse(doors.split('\n').filter((l) => l.startsWith('{')).pop() ?? '{}') as Record<string, string>;
const is = (k: string, want: string, what: string): void => check(what, got[k] === want, `${k}: ${JSON.stringify(got[k])}`);

is('JOIN_POSER', 'Wanderer', 'a body that joins as Moderator is kept as Wanderer');
is('JOIN_KEEPERS', 'Wanderer', 'and one that joins as the keeper, by a homoglyph, keeps the name it had');
is('JOIN_CLEAN', cleanText('Bert\u202E\u200B the\nlong-named one of Textrock', 20).trim(), 'a body\'s name is cleaned and cut at an account name\'s length');
is('SAY', cleanText(`${NASTY[0]} ${NASTY[1]}\n${NASTY[4]}`, SAY_MAX), 'talk is said cleaned: no override, no zero-width, no newline');
check('and kept so', got.SAY_KEPT === `<textanna> ${got.SAY}`, got.SAY_KEPT);
is('LETTER', cleanText(`${NASTY[4]}\u202E`), 'a letter is sent cleaned');
is('LETTER_KEPT', cleanText(`${NASTY[4]}\u202E`), 'and kept so');
is('CRATE_HOMOGLYPH', NAME_RESERVED, 'a crate named K\u0435eper, by a homoglyph, is refused in the browser\'s words');
is('CRATE_KEEPERNAME', NAME_RESERVED, 'and one named as the island\'s keeper, by a digit');
is('CRATE_UNNAMED', 'NONE', 'and neither is kept');
is('CRATE_CLEAN_WHY', 'ALLOWED', 'a crate named Beekeeper stores is not refused');
is('CRATE_CLEAN', cleanText('Bee\u200Bkeeper\u202E stores\n and more and more and more', NAME_MAX), `and is kept cleaned, at ${NAME_MAX} characters`);
is('CRATE_KEEPER', 'ALLOWED', 'the keeper may name a crate Keeper\'s');
is('CRATE_KEEPER_NAME', 'Keeper\'s', 'and it is kept');
is('BEAST_STAFF', NAME_RESERVED, 'a wildermon renamed Adm1n is refused');
is('BEAST_LONG', '24', 'a wildermon named in 500 characters is called by 24 of them');
is('SETTLE_STAFF', NAME_RESERVED, 'a settlement renamed The System is refused');
is('RANK_STAFF', NAME_RESERVED, 'a rank named Adm1n is refused');
is('RANK_CLEAN', 'Warden', 'a rank is kept cleaned');
is('NOTICE_WHY', 'ALLOWED', 'a notice is posted');
is('NOTICE', cleanText('Meet\u200B at\n\n the\u202E well'), 'and kept cleaned');
is('FOUND', NAME_RESERVED, 'an island founded as System is refused in the same words');
is('FOUND_ROW', '0', 'and is not made');
is('FREE_STAFF', 'false', 'an account name that poses as staff is not free');
is('FREE_OK', 'true', 'and Beekeeper is');
is('MYNAME_STAFF', 'NONE', 'a sign-up that poses as staff is not taken up as an account');
is('MYNAME_ROW', '0', 'and no account is made');

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nplayer text — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
