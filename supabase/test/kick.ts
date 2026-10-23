/**
 * Kick, bar, and player reports.
 *
 * On two islands of its own, Kick Hold (founded by Fenna, with Osric made an
 * owner of every island) and Kick Elsewhere (founded by Otto):
 *
 *   * kick, unbar, the open reports and Handled refuse nobody signed in, a
 *     token with nobody in it, a player of the island, a player of another
 *     island and the founder of another island, before anything is done or
 *     written down;
 *   * a kick logs the body off as the idle log-out does (away, job stopped,
 *     queue emptied), takes it off the beast it rode, tells both ends, sends its
 *     browser `kicked` and says "Logged off" to the island;
 *   * a barred body is refused by every door of that island it knocks on --
 *     move, act, say, a letter, coming back ashore -- in one line that says
 *     until when, and nothing of it changes; on another island it plays on;
 *   * who is on says who is barred and for how much longer, in the window's words;
 *   * no kick of yourself, of a keeper, for less than nothing, or of somebody
 *     with no body here;
 *   * a bar lifts when a keeper lifts it and by itself when its time is up, and
 *     a kick of 0 seconds bars nothing;
 *   * a report is kept with its reason and its note cut to the most a note
 *     keeps; the one reported is not told; one about the same body a day, five
 *     a day in all, a reason from the list, not about yourself, not while barred;
 *   * keepers see the open ones, newest first, with how many are open on the
 *     same body, and Handled takes one off the list;
 *   * what is past keeping goes when the next report comes;
 *   * the trail has every kick, unbar and Handled; no browser reads the tables
 *     or calls the helpers; the numbers are the browser's.
 *
 * And what the bar costs `rpc_move` with nobody barred, printed.
 *
 * Makes and removes everything it uses.
 */
import { execFileSync } from 'node:child_process';
import { awayFor } from '../../src/game/away';
import {
  BAR_FOR, barLabel, barLine, isBarred, REPORT_HANDLED_DAYS, REPORT_NOTE_MAX, REPORT_OPEN_DAYS, REPORT_REASONS, REPORTS_A_DAY,
  type Kept, type KeptBody, type KeptReport,
} from '../../src/game/keeper';

const ENV = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
  PGPORT: process.env.PGPORT ?? '5433',
  PGUSER: process.env.PGUSER ?? 'wurm',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
};

interface Ran { out: string; err: string }

function run(args: string[], input = ''): Ran {
  try {
    const out = execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', ...args],
      { input, encoding: 'utf8', env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    return { out: out.trim(), err: '' };
  } catch (e) {
    const x = e as { stdout?: string; stderr?: string };
    return { out: (x.stdout ?? '').trim(), err: (x.stderr ?? '').trim() || String(e) };
  }
}
const sql = (text: string): Ran => run(['-f', '-'], text);
const psql = (text: string): string => {
  const r = sql(text);
  if (r.err) throw new Error(r.err);
  return r.out;
};
const claims = (who: string | null): string =>
  `select set_config('request.jwt.claims', '${who ? JSON.stringify({ sub: who }) : ''}', false) \\g /dev/null`;
/** Through the role a browser has, as somebody signed in, or with a token that names nobody. */
const as = (who: string | null, text: string): Ran => sql(`${claims(who)}\nset role authenticated;\n${text}\n`);
const anon = (text: string): Ran => sql(`set role anon;\n${text}\n`);
const parsed = <T>(r: Ran): T | null => {
  try {
    return JSON.parse(r.out) as T;
  } catch {
    return null;
  }
};
/** What a door said in refusing: the exception's own line, without psql's "ERROR:  ". */
const refused = (r: Ran): string => (/ERROR:\s+(.*)/.exec(r.err)?.[1] ?? '').trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const KEEP = 'ef000000-0000-4000-8000-0000000000a1';
const THERE = 'ef000000-0000-4000-8000-0000000000a2';
const FOUNDER = 'ef000000-0000-4000-8000-000000000001'; // Fenna, who founded Kick Hold
const OWNER = 'ef000000-0000-4000-8000-000000000002'; // Osric, an owner of every island
const PLAYER = 'ef000000-0000-4000-8000-000000000003'; // Pell, who plays on Kick Hold
const STIG = 'ef000000-0000-4000-8000-000000000004'; // Stig, kicked, who plays on both
const OTHER = 'ef000000-0000-4000-8000-000000000006'; // Otto, who founded Kick Elsewhere
const STRANGER = 'ef000000-0000-4000-8000-000000000007'; // Sten, who plays only there
const NOBODY = 'ef000000-0000-4000-8000-000000000008'; // signed in, with no body anywhere
const FOLK = ['ef000000-0000-4000-8000-000000000011', 'ef000000-0000-4000-8000-000000000012',
  'ef000000-0000-4000-8000-000000000013', 'ef000000-0000-4000-8000-000000000014',
  'ef000000-0000-4000-8000-000000000015']; // Ada, Bo, Cy, Di, Ed, whom Pell reports
const ALL = [FOUNDER, OWNER, PLAYER, STIG, OTHER, STRANGER, NOBODY, ...FOLK];
const list = (xs: string[]): string => xs.map((x) => `'${x}'`).join(', ');

const CLEAN = `
delete from private.owner_log where world_id in ('${KEEP}', '${THERE}');
delete from private.island_bar where world_id in ('${KEEP}', '${THERE}');
delete from private.player_report where world_id in ('${KEEP}', '${THERE}');
delete from world where id in ('${KEEP}', '${THERE}');
delete from private.island_owner where uid in (${list(ALL)});
delete from auth.users where id in (${list(ALL)});
delete from caller where uid in (${list(ALL)});
delete from realtime.messages where topic like '%:${KEEP}%' or topic like '%:${THERE}%';
`;
psql(CLEAN);
const BODY = `'{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb`;
psql(`
insert into auth.users (id, email) select u, 'k' || right(u::text, 2) || '@kick.test' from unnest(array[${list(ALL)}]::uuid[]) u;
insert into private.island_owner (uid) values ('${OWNER}');
insert into world (id, name, seed, size, spawn_x, spawn_y, ready, made_by) values
  ('${KEEP}', 'Kick Hold', 1, 32, 10, 12, true, '${FOUNDER}'),
  ('${THERE}', 'Kick Elsewhere', 2, 16, 4, 4, true, '${OTHER}');
select land_blank('${KEEP}', 32) \\g /dev/null
select land_blank('${THERE}', 16) \\g /dev/null
insert into player (world_id, uid, name, x, y, stats) values
  ('${KEEP}', '${FOUNDER}', 'Fenna', 10.5, 12.5, ${BODY}), ('${KEEP}', '${OWNER}', 'Osric', 11.5, 12.5, ${BODY}),
  ('${KEEP}', '${PLAYER}', 'Pell', 12.5, 12.5, ${BODY}), ('${KEEP}', '${STIG}', 'Stig', 3.5, 28.5, ${BODY}),
  ('${KEEP}', '${FOLK[0]}', 'Ada', 5.5, 5.5, ${BODY}), ('${KEEP}', '${FOLK[1]}', 'Bo', 6.5, 5.5, ${BODY}),
  ('${KEEP}', '${FOLK[2]}', 'Cy', 7.5, 5.5, ${BODY}), ('${KEEP}', '${FOLK[3]}', 'Di', 8.5, 5.5, ${BODY}),
  ('${KEEP}', '${FOLK[4]}', 'Ed', 9.5, 5.5, ${BODY}),
  ('${THERE}', '${OTHER}', 'Otto', 4.5, 4.5, ${BODY}), ('${THERE}', '${STRANGER}', 'Sten', 5.5, 4.5, ${BODY}),
  ('${THERE}', '${STIG}', 'Stig', 6.5, 4.5, ${BODY});
update player set seen_at = now(), moved_at = now() - interval '2 seconds' where world_id in ('${KEEP}', '${THERE}');
`);

/* ---- nobody else gets in ------------------------------------------------------ */
console.log('--- who may not');
const DOORS: Array<[string, string]> = [
  ['kick', `select rpc_owner_kick('${KEEP}', '${STIG}', 3600);`],
  ['unbar', `select rpc_owner_unbar('${KEEP}', '${STIG}');`],
  ['the open reports', `select rpc_owner_reports('${KEEP}');`],
  ['handled', `select rpc_owner_report_handled('${KEEP}', 1);`],
];
const REFUSED = 'only a keeper of this island may do that';
const NOT_OWNERS: Array<[string, string | null]> = [
  ['a token that names nobody', null],
  ['an account with no body anywhere', NOBODY],
  ['a player of this island', PLAYER],
  ['a player of another island', STRANGER],
  ['the founder of another island', OTHER],
];
for (const [door, call] of DOORS) {
  const a = anon(call);
  check(`${door}: nobody signed in may not so much as call it`, a.err.includes('permission denied for function'), a.err || a.out);
  for (const [who, uid] of NOT_OWNERS) {
    const r = as(uid, call);
    check(`${door}: refused to ${who}`, r.err.includes(REFUSED), r.err || r.out);
  }
}
check('reporting and asking about a bar: nobody signed in may not call them',
  anon(`select rpc_report_player('${KEEP}', '${STIG}', 'abuse', null);`).err.includes('permission denied for function')
  && anon(`select rpc_barred('${KEEP}');`).err.includes('permission denied for function'));
const untouched = psql(`
select (select count(*) from caller where uid in (${list([NOBODY, PLAYER, STRANGER, OTHER])})) || '|'
    || (select away::text from player where world_id = '${KEEP}' and uid = '${STIG}') || '|'
    || (select count(*) from private.island_bar where world_id = '${KEEP}') || '|'
    || (select count(*) from private.owner_log where world_id = '${KEEP}');`);
check('refused before anything else: no call counted, nobody logged off or barred, nothing written down',
  untouched === '0|false|0|0', untouched);

/* ---- a kick ------------------------------------------------------------------- */
console.log('--- a kick');
const stops = psql(`select private.move_stops(verb, 1, false) from action_def where id = 'dig';`);
psql(`
update player set act = 'dig', act_target = '{"kind":"tile","x":3,"y":28}'::jsonb, act_started = now(),
       act_ends = now() + interval '1 hour', act_left = 1, act_goes = 1,
       act_queue = '[{"action":"dig","target":{"kind":"tile","x":3,"y":28},"goes":1}]'::jsonb
 where world_id = '${KEEP}' and uid = '${STIG}';
do $$
declare c int := creature_spawn('${KEEP}', 'rabba', 3.5, 28.5, 'active', now() - interval '3 days', '${STIG}');
begin
  update creature set rider = '${STIG}', name = 'Bess' where world_id = '${KEEP}' and id = c;
end $$;`);
const loggedOff = Number(psql(`select count(*) from event where world_id = '${KEEP}' and kind = 'presence' and text = 'Logged off: Stig';`));
const kicked = parsed<{ kicked: boolean; barred: boolean; secs: number; stopped: string; queued: number; off: string[] }>(
  as(FOUNDER, `select rpc_owner_kick('${KEEP}', '${STIG}', 3600);`));
check('a keeper kicks somebody and bars them for an hour',
  kicked?.kicked === true && kicked.barred && kicked.secs === 3600 && kicked.stopped === 'dig' && kicked.queued === 1,
  JSON.stringify(kicked));
const after = psql(`select away || ',' || coalesce(act, 'none') || ',' || act_queue::text || ',' || (left_at is not null)
  from player where world_id = '${KEEP}' and uid = '${STIG}';`);
check('logged off as the idle log-out does it: away, job stopped, queue empty', after === 'true,none,[],true', after);
check('and off the beast it rode, which stays where it was',
  psql(`select count(*) from creature where world_id = '${KEEP}' and rider = '${STIG}';`) === '0'
    && kicked?.off.join() === 'riding Bess', JSON.stringify(kicked?.off));
const toldStig = psql(`select text from event where world_id = '${KEEP}' and uid = '${STIG}' order by n desc limit 1;`);
check('the one kicked is told who did it and for how long',
  /^Fenna, who keeps this island, has logged you off and barred you for 1 hour, until \d{1,2} [A-Z][a-z]{2} \d{2}:\d{2} UTC\.$/.test(toldStig),
  toldStig);
const toldFenna = psql(`select text from event where world_id = '${KEEP}' and uid = '${FOUNDER}' order by n desc limit 1;`);
check('and the keeper, in the same words about them',
  /^You log Stig off and bar them for 1 hour, until \d{1,2} [A-Z][a-z]{2} \d{2}:\d{2} UTC\. (.*) They are no longer riding Bess\.$/.exec(toldFenna)?.[1] === stops
    && stops.startsWith('They stop '),
  toldFenna);
check('its browser is sent `kicked`',
  psql(`select count(*) from realtime.messages where topic = 'own:${KEEP}:${STIG}' and event = 'kicked';`) === '1');
check('and the island is told it logged off, once',
  Number(psql(`select count(*) from event where world_id = '${KEEP}' and kind = 'presence' and text = 'Logged off: Stig';`)) === loggedOff + 1);

/* ---- barred ------------------------------------------------------------------- */
console.log('--- barred');
const BARRED = /^Barred from this island for (\d+ \w+(?: and \d+ \w+)?) more, until \d{1,2} [A-Z][a-z]{2} \d{2}:\d{2} UTC\.$/;
const moveR = as(STIG, `select rpc_move('${KEEP}', 4.0, 28.5, 0);`);
check('a step is refused, saying for how long and until when',
  BARRED.test(refused(moveR)) && BARRED.exec(refused(moveR))?.[1] === awayFor(3600) && isBarred(refused(moveR)), moveR.err || moveR.out);
const actR = as(STIG, `select rpc_act('${KEEP}', 'dig', '{"kind":"tile","x":3,"y":28}'::jsonb);`);
check('a job is refused in the same line', refused(actR) === refused(moveR), actR.err || actR.out);
const sayR = parsed<{ said: string | null; why: string }>(as(STIG, `select rpc_say('${KEEP}', 'let me in');`));
check('so are words aloud', sayR?.said === null && sayR.why === refused(moveR), JSON.stringify(sayR));
const letterR = parsed<{ why: string }>(as(STIG, `select rpc_letter('${KEEP}', '${PLAYER}', 'let me in');`));
check('and a letter', letterR?.why === refused(moveR), JSON.stringify(letterR));
const joinR = as(STIG, `select rpc_join('${KEEP}', 'Stig');`);
check('and coming back ashore', refused(joinR) === refused(moveR), joinR.err || joinR.out);
const reportR = as(STIG, `select rpc_report_player('${KEEP}', '${PLAYER}', 'abuse', null);`);
check('and a report', refused(reportR) === refused(moveR), reportR.err || reportR.out);
const still = psql(`select away || ',' || x || ',' || y || ',' || coalesce(act, 'none') from player where world_id = '${KEEP}' and uid = '${STIG}';`);
check('and nothing of the body changed: still away, where it stood, idle', still === 'true,3.5,28.5,none', still);
check('nothing said or written', psql(`select (select count(*) from event where world_id = '${KEEP}' and said_by = '${STIG}')
  + (select count(*) from letter where world_id = '${KEEP}' and sender = '${STIG}');`) === '0');
const asked = parsed<{ line: string | null }>(as(STIG, `select rpc_barred('${KEEP}');`));
check('the sign-in page is told the same line', asked?.line === refused(moveR), JSON.stringify(asked));
check('and somebody not barred is told nothing', parsed<{ line: string | null }>(as(PLAYER, `select rpc_barred('${KEEP}');`))?.line === null);
const elsewhere = as(STIG, `select rpc_move('${THERE}', 6.9, 4.5, 0);`);
check('on another island the same body plays on', !elsewhere.err && parsed<{ x: number }>(elsewhere)?.x !== undefined, elsewhere.err || elsewhere.out);
check('and talks', parsed<{ said: string }>(as(STIG, `select rpc_say('${THERE}', 'hello');`))?.said === 'hello');

const seen = parsed<Kept>(as(OWNER, `select rpc_owner_online('${KEEP}');`));
const stig = seen?.people.find((b) => b.uid === STIG);
check('who is on says who is barred and for how much longer',
  !!stig && stig.barred && stig.barred_for !== null && Math.abs(stig.barred_for - 3600) <= 10 && stig.away, JSON.stringify(stig));
check('in the window\'s words', !!stig && barLine(stig) === `barred for ${awayFor(stig.barred_for ?? 0)} more`, stig ? barLine(stig) : '');
check('and nobody else is barred', !!seen && seen.people.filter((b) => b.uid !== STIG).every((b: KeptBody) => !b.barred && b.barred_for === null));

/* ---- what a kick will not do -------------------------------------------------- */
console.log('--- not that');
const why = (who: string, call: string): string => parsed<{ why?: string }>(as(who, call))?.why ?? '';
check('no kicking yourself', why(FOUNDER, `select rpc_owner_kick('${KEEP}', '${FOUNDER}', 60);`) === 'A keeper cannot kick themselves.');
check('nor another keeper', why(FOUNDER, `select rpc_owner_kick('${KEEP}', '${OWNER}', 60);`) === 'Osric keeps this island: a keeper cannot be kicked.');
check('nor for less than nothing', why(FOUNDER, `select rpc_owner_kick('${KEEP}', '${PLAYER}', -5);`) === 'A bar lasts 0 or more seconds, or until it is lifted.');
check('nor somebody with no body here', why(FOUNDER, `select rpc_owner_kick('${KEEP}', '${NOBODY}', 60);`) === 'That person has no body on this island.');
check('and Pell, refused all three, was never logged off', psql(`select away from player where world_id = '${KEEP}' and uid = '${PLAYER}';`) === 'f');

/* ---- lifted ------------------------------------------------------------------- */
console.log('--- lifted');
const lifted = parsed<{ barred: boolean }>(as(OWNER, `select rpc_owner_unbar('${KEEP}', '${STIG}');`));
check('a keeper lifts the bar', lifted?.barred === false, JSON.stringify(lifted));
check('and they are told', psql(`select text from event where world_id = '${KEEP}' and uid = '${STIG}' order by n desc limit 1;`)
  === 'Osric, who keeps this island, has lifted your bar.');
const back = as(STIG, `select rpc_join('${KEEP}', 'Stig') is not null;`);
check('they come back ashore', back.out === 't' && psql(`select away from player where world_id = '${KEEP}' and uid = '${STIG}';`) === 'f', back.err || back.out);
const stepped = as(STIG, `select rpc_move('${KEEP}', 4.0, 28.5, 0)->>'x';`);
check('and step', !stepped.err && Number(stepped.out) > 3.5, stepped.err || stepped.out);
check('and talk', parsed<{ said: string }>(as(STIG, `select rpc_say('${KEEP}', 'sorry');`))?.said === 'sorry');
check('lifting a bar that is not there says so', why(OWNER, `select rpc_owner_unbar('${KEEP}', '${STIG}');`) === 'Stig is not barred.');

const brief = as(FOUNDER, `select rpc_owner_kick('${KEEP}', '${STIG}', 2) \\g /dev/null
${claims(STIG)}
select rpc_move('${KEEP}', 4.2, 28.5, 0);
`);
check('a bar of two seconds holds for those seconds', isBarred(refused(brief)), brief.err || brief.out);
const later = as(STIG, `select pg_sleep(2.2) \\g /dev/null
select rpc_join('${KEEP}', 'Stig') is not null;`);
check('and lifts by itself when they are up', later.out === 't', later.err || later.out);

const off = parsed<{ kicked: boolean; barred: boolean }>(as(FOUNDER, `select rpc_owner_kick('${KEEP}', '${STIG}', 0);`));
check('a kick of 0 seconds logs off and bars nothing',
  off?.kicked === true && off.barred === false && psql(`select away from player where world_id = '${KEEP}' and uid = '${STIG}';`) === 't',
  JSON.stringify(off));
check('and says so', /^Fenna, who keeps this island, has logged you off\.$/.test(
  psql(`select text from event where world_id = '${KEEP}' and uid = '${STIG}' order by n desc limit 1;`)));
check('they may come straight back', as(STIG, `select rpc_join('${KEEP}', 'Stig') is not null;`).out === 't');

as(OWNER, `select rpc_owner_kick('${KEEP}', '${STIG}', null);`);
const forever = refused(as(STIG, `select rpc_move('${KEEP}', 4.0, 28.5, 0);`));
check('a bar until lifted says so', forever === 'Barred from this island until a keeper lifts it.', forever);
const foreverSeen = parsed<Kept>(as(OWNER, `select rpc_owner_online('${KEEP}');`))?.people.find((b) => b.uid === STIG);
check('and the list says it lasts until lifted', !!foreverSeen && foreverSeen.barred && foreverSeen.barred_for === null
  && barLine(foreverSeen) === 'barred until lifted', JSON.stringify(foreverSeen));
const sentKicks = psql(`select count(*) from realtime.messages where topic = 'own:${KEEP}:${STIG}' and event = 'kicked';`);
check('every kick of a body ashore sent its browser `kicked`', sentKicks === '4', sentKicks);
const again = parsed<{ barred: boolean }>(as(OWNER, `select rpc_owner_kick('${KEEP}', '${STIG}', 60);`));
const againSeen = parsed<Kept>(as(OWNER, `select rpc_owner_online('${KEEP}');`))?.people.find((b) => b.uid === STIG);
check('kicking again replaces the time left', again?.barred === true && !!againSeen && againSeen.barred_for !== null
  && againSeen.barred_for <= 60 && againSeen.barred_for > 50, JSON.stringify(againSeen));
check('and a browser already away is sent nothing',
  psql(`select count(*) from realtime.messages where topic = 'own:${KEEP}:${STIG}' and event = 'kicked';`) === sentKicks);

/* ---- reports ------------------------------------------------------------------ */
console.log('--- reports');
const report = (who: string, whom: string, reason: string, note: string | null): { reported?: boolean; n?: number; why?: string } | null =>
  parsed(as(who, `select rpc_report_player('${KEEP}', '${whom}', '${reason}', ${note === null ? 'null' : `'${note}'`});`));
const long = 'x'.repeat(REPORT_NOTE_MAX + 100);
const first = report(PLAYER, FOLK[0] ?? '', 'abuse', `  called me\n\nnames  ${long}`);
check('anybody reports somebody', first?.reported === true && typeof first.n === 'number', JSON.stringify(first));
const kept = psql(`select reason || '|' || char_length(note) || '|' || left(note, 18) from private.player_report where n = ${first?.n ?? 0};`);
check('with the reason, and the note cleaned and cut to the most a note keeps', kept === `abuse|${REPORT_NOTE_MAX}|called me names xx`, kept);
check('the one reported is not told', psql(`select count(*) from event where world_id = '${KEEP}' and uid = '${FOLK[0]}';`) === '0'
  && psql(`select count(*) from realtime.messages where topic = 'own:${KEEP}:${FOLK[0]}';`) === '0');
check('the same body again within a day is refused',
  /^Already reported Ada in the last 24 hours\. Next in (23 hours and 59 minutes|1 day)\.$/.test(report(PLAYER, FOLK[0] ?? '', 'cheating', null)?.why ?? ''),
  report(PLAYER, FOLK[0] ?? '', 'cheating', null)?.why);
check('a reason off the list is refused', report(PLAYER, FOLK[1] ?? '', 'smells', null)?.why === 'Reason: cheating, abuse, griefing, other.');
check('so is reporting yourself', report(PLAYER, PLAYER, 'other', null)?.why === 'You cannot report yourself.');
check('and somebody with no body here', report(PLAYER, NOBODY, 'other', null)?.why === 'That person has no body on this island.');
const noBody = as(NOBODY, `select rpc_report_player('${KEEP}', '${PLAYER}', 'other', null);`);
check('nor may somebody with no body here report', refused(noBody) === 'you are not on this island', noBody.err || noBody.out);
const more = [FOLK[1], FOLK[2], FOLK[3]].map((u) => report(PLAYER, u ?? '', 'griefing', null));
check(`up to ${REPORTS_A_DAY} a day go through`, more.every((r) => r?.reported === true), JSON.stringify(more));
const fifth = report(PLAYER, STIG, 'cheating', 'flying');
check('the fifth too', fifth?.reported === true, JSON.stringify(fifth));
const sixth = report(PLAYER, FOLK[4] ?? '', 'other', null);
check('and the sixth is refused, saying when the next may go',
  /^Report limit: 5 in 24 hours\. Next in (23 hours and 59 minutes|1 day)\.$/.test(sixth?.why ?? ''), sixth?.why);
check('nothing refused was written', psql(`select count(*) from private.player_report where world_id = '${KEEP}' and by_uid = '${PLAYER}';`) === '5');
const second = report(FOLK[0] ?? '', STIG, 'abuse', null);
check('somebody else reports the same body', second?.reported === true, JSON.stringify(second));

const open = (who: string): KeptReport[] | null => parsed<{ reports: KeptReport[] }>(as(who, `select rpc_owner_reports('${KEEP}');`))?.reports ?? null;
const reports = open(OWNER);
check('a keeper sees the open ones, newest first', reports?.length === 6 && reports.every((r, i) => i === 0 || (reports[i - 1]?.n ?? 0) > r.n),
  JSON.stringify(reports?.map((r) => r.n)));
const top = reports?.[0];
check('who sent it, about whom, why, and how long ago',
  top?.by.name === 'Ada' && top.whom.name === 'Stig' && top.whom.uid === STIG && top.reason === 'abuse' && top.note === null && top.ago <= 5,
  JSON.stringify(top));
check('with how many are open on the same body', top?.against === 2 && reports?.find((r) => r.whom.uid === FOLK[1])?.against === 1);
check('and the note', reports?.find((r) => r.n === first?.n)?.note?.startsWith('called me names') === true);
check('the founder sees them too', open(FOUNDER)?.length === 6);
check('and nobody else', as(PLAYER, `select rpc_owner_reports('${KEEP}');`).err.includes(REFUSED));
check('the other island\'s keeper sees none of them', as(OTHER, `select rpc_owner_reports('${KEEP}');`).err.includes(REFUSED)
  && parsed<{ reports: KeptReport[] }>(as(OTHER, `select rpc_owner_reports('${THERE}');`))?.reports.length === 0);

const handled = parsed<{ handled: boolean }>(as(FOUNDER, `select rpc_owner_report_handled('${KEEP}', ${top?.n ?? 0});`));
check('Handled takes one off the open list', handled?.handled === true && open(OWNER)?.length === 5
  && open(OWNER)?.find((r) => r.whom.uid === STIG)?.against === 1, JSON.stringify(handled));
check('twice is refused', why(OWNER, `select rpc_owner_report_handled('${KEEP}', ${top?.n ?? 0});`) === 'That report is not open.');
check('and one from another island is not this island\'s to handle',
  why(OTHER, `select rpc_owner_report_handled('${THERE}', ${first?.n ?? 0});`) === 'That report is not open.');

psql(`
insert into private.player_report (world_id, at, by_uid, whom, reason, handled_by, handled_at) values
  ('${KEEP}', now() - interval '${REPORT_HANDLED_DAYS + 1} days', '${FOLK[2]}', '${STIG}', 'other', '${FOUNDER}', now() - interval '${REPORT_HANDLED_DAYS} days'),
  ('${KEEP}', now() - interval '${REPORT_HANDLED_DAYS + 10} days', '${FOLK[2]}', '${STIG}', 'other', null, null),
  ('${KEEP}', now() - interval '${REPORT_OPEN_DAYS + 1} days', '${FOLK[2]}', '${STIG}', 'other', null, null),
  ('${KEEP}', now() - interval '2 days', '${FOLK[2]}', '${STIG}', 'other', '${FOUNDER}', now() - interval '1 day');`);
report(FOLK[2] ?? '', PLAYER, 'other', null);
const left = psql(`select string_agg(extract(day from now() - at)::int || (case when handled_at is null then 'o' else 'h' end), ',' order by at)
  from private.player_report where world_id = '${KEEP}' and by_uid = '${FOLK[2]}';`);
check(`what is past keeping goes when the next report comes: handled after ${REPORT_HANDLED_DAYS} days, open after ${REPORT_OPEN_DAYS}`,
  left === `${REPORT_HANDLED_DAYS + 10}o,2h,0o`, left);

/* ---- the trail ---------------------------------------------------------------- */
console.log('--- the trail');
const trail = psql(`
select string_agg(l.what || ' ' || case l.owner when '${FOUNDER}' then 'Fenna' when '${OWNER}' then 'Osric' else l.owner::text end
                  || coalesce(' ' || (select p.name from player p where p.world_id = l.world_id and p.uid = l.whom), ''), ', ' order by l.n)
  from private.owner_log l where l.world_id = '${KEEP}' and l.what in ('kick', 'unbar', 'handled');`);
check('every kick, unbar and Handled is written down, in order',
  trail === 'kick Fenna Stig, unbar Osric Stig, kick Fenna Stig, kick Fenna Stig, kick Osric Stig, kick Osric Stig, handled Fenna Stig', trail);
const kickNote = psql(`select detail->>'secs' || ',' || (detail->>'barred') || ',' || (detail->>'stopped') || ',' || (detail->>'queued')
  from private.owner_log where world_id = '${KEEP}' and what = 'kick' order by n limit 1;`);
check('with how long, and what was stopped', kickNote === '3600,true,dig,1', kickNote);
check('and nobody who was refused wrote anything',
  psql(`select count(*) from private.owner_log where owner in (${list([NOBODY, PLAYER, STRANGER, OTHER, STIG])});`) === '0');

/* ---- out of reach, and the numbers -------------------------------------------- */
console.log('--- out of reach');
for (const table of ['private.island_bar', 'private.player_report']) {
  const r = as(PLAYER, `select count(*) from ${table};`);
  check(`${table} cannot be read from a browser`, r.err.includes('permission denied'), r.err || r.out);
}
const helpers = psql(`
select string_agg(p.proname, ', ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private' and p.proname in ('barred_why', 'bar_span', 'bar_holds', 'report_reasons', 'report_note_max',
       'reports_a_day', 'report_handled_days', 'report_open_days')
   and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'));`);
check('and none of the helpers can be called from one', helpers === '', helpers);
const numbers = psql(`select array_to_string(private.report_reasons(), ',') || '|' || private.report_note_max() || '|' || private.reports_a_day()
  || '|' || private.report_handled_days() || '|' || private.report_open_days();`);
check('the island\'s numbers are the browser\'s',
  numbers === `${REPORT_REASONS.map((r) => r.id).join(',')}|${REPORT_NOTE_MAX}|${REPORTS_A_DAY}|${REPORT_HANDLED_DAYS}|${REPORT_OPEN_DAYS}`, numbers);
check('the kick menu offers what BAR_FOR holds, in those words',
  BAR_FOR.map(barLabel).join(', ') === `Log off only, Bar for ${awayFor(3600)}, Bar for ${awayFor(86400)}, Bar until lifted`,
  BAR_FOR.map(barLabel).join(', '));

/* ---- what it costs ------------------------------------------------------------ */
// rpc_move, staying in its tile, with nobody barred: the probe in `settle` and a trigger that never fires.
const cost = psql(`
begin;
${claims(PLAYER)}
delete from private.island_bar where world_id = '${KEEP}';
create function pg_temp.t(p_n int) returns double precision language plpgsql as $f$
declare t0 timestamptz; i int; r int; took double precision; best double precision := 1e9;
begin
  for r in 1..3 loop
    took := 0;
    for i in 1..p_n loop
      update player set x = 12.2, y = 12.5, moved_at = now() - interval '1 second' where world_id = '${KEEP}' and uid = '${PLAYER}';
      delete from caller where uid = '${PLAYER}';
      t0 := clock_timestamp();
      perform rpc_move('${KEEP}', 12.5, 12.5, 0);
      took := took + extract(epoch from clock_timestamp() - t0);
    end loop;
    best := least(best, took / p_n * 1000);
  end loop;
  return best;
end $f$;
select pg_temp.t(300);
rollback;`).split('\n').pop() ?? '';
console.log(`COST rpc_move ${Number(cost).toFixed(3)} ms a step, nobody barred`);

psql(CLEAN);
for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`kick, bar and reports — ${ok.length} of ${ok.length}`);
