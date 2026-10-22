/**
 * Accounts: where they connect from, new bodies per connection, and the
 * keeper doors' second step.
 *
 * On an island of its own, Account Rock (founded by Fenna):
 *
 *   * the join and the beat note the caller's address from the request's
 *     headers (`cf-connecting-ip`, else the first of `x-forwarded-for`), once;
 *     the beat writes a known address again only after `ip_note_every()`, a
 *     new one at once; no headers and a header that is not an address note
 *     nothing and refuse nothing; the clock's tidy forgets an address unseen
 *     for `ip_keep()` and keeps a younger one;
 *   * one connection makes `ip_body_cap()` new bodies in `ip_body_window()`
 *     and is refused the next, in so many words, with nothing made; another
 *     connection is not; coming back to a body is not; a keeper of the island
 *     is not; and once the window has passed, it may again;
 *   * a keeper with no verified second factor uses the doors as before (an
 *     unverified one does not count); with a verified one, every door but
 *     `rpc_owner_am_i` refuses an `aal1` token and one with no `aal`, in the
 *     browser's words (`KEEPER_CODE`), and opens to an `aal2` one; somebody
 *     who keeps nothing is refused as before whatever their token says; and
 *     every keeper door there is carries the rule;
 *   * no browser can read the tables or call the helpers.
 *
 * Makes and removes everything it uses.
 */
import { execFileSync } from 'node:child_process';
import { KEEPER_CODE, NEW_BODIES_A_DAY } from '../../src/game/keeper';

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
const lit = (s: string): string => `'${s.replace(/'/g, "''")}'`;

interface As {
  /** The request's headers, as PostgREST hands them over; omitted: none at all. */
  headers?: Record<string, string>;
  /** The token's `aal`; omitted: no such claim. */
  aal?: 'aal1' | 'aal2';
}
/** Through the role a browser has, as somebody signed in, with these headers and this assurance. */
const as = (who: string, text: string, o: As = {}): Ran => sql(
  `select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: who, ...(o.aal ? { aal: o.aal } : {}) }))}, false) \\g /dev/null\n`
  + `select set_config('request.headers', ${lit(o.headers ? JSON.stringify(o.headers) : '')}, false) \\g /dev/null\n`
  + `set role authenticated;\n${text}\n`);
const anon = (text: string): Ran => sql(`set role anon;\n${text}\n`);

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const ROCK = 'ac000000-0000-4000-8000-0000000000a1';
const FOUNDER = 'ac000000-0000-4000-8000-000000000001'; // Fenna, who founded Account Rock
const PEOPLE = Array.from({ length: 9 }, (_, i) => `ac000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`);
const [ANNA, BERT, CARL, DORA, EMIL, FINN, GRETA, HUGO, IDA] = PEOPLE;
const ALL = [FOUNDER, ...PEOPLE];
const list = (xs: string[]): string => xs.map((x) => `'${x}'`).join(', ');

const CLEAN = `
delete from private.owner_log where world_id = '${ROCK}';
delete from world where id = '${ROCK}';
delete from private.player_ip where uid in (${list(ALL)});
delete from private.ip_body where uid in (${list(ALL)}) or world_id = '${ROCK}';
delete from auth.mfa_factors where user_id in (${list(ALL)});
delete from auth.users where id in (${list(ALL)});
delete from caller where uid in (${list(ALL)});
delete from realtime.messages where topic like '%:${ROCK}%';
`;
psql(CLEAN);
psql(`
insert into auth.users (id, email) values ${ALL.map((u, i) => `('${u}', 'acc${i}@accounts.test')`).join(', ')};
insert into world (id, name, seed, size, spawn_x, spawn_y, ready, made_by) values
  ('${ROCK}', 'Account Rock', 7, 32, 10, 12, true, '${FOUNDER}');
select land_blank('${ROCK}', 32) \\g /dev/null
`);

const xff = (ip: string): Record<string, string> => ({ 'x-forwarded-for': `${ip}, 10.0.0.1, 172.16.0.9` });
const join = (who: string, o: As = {}): Ran => as(who, `select (rpc_join('${ROCK}', 'Tester') ->> 'new');`, o);
const settle = (who: string, o: As = {}): Ran => as(who, `select rpc_settle(0, '${ROCK}') is not null;`, o);
const ips = (who: string): string => psql(
  `select coalesce(string_agg(host(ip) || ':' || seen, ',' order by ip), '') from private.player_ip where uid = '${who}';`);
const hasBody = (who: string): boolean =>
  psql(`select count(*) from player where world_id = '${ROCK}' and uid = '${who}';`) === '1';

/* ---- where they connect from -------------------------------------------------- */
console.log('--- addresses');
const j1 = join(ANNA, { headers: xff('203.0.113.7') });
check('a join with x-forwarded-for makes a body', j1.out === 'true' && !j1.err, j1.err || j1.out);
check('and notes the first address in the header, once', ips(ANNA) === '203.0.113.7:1', ips(ANNA));
const firstAt = psql(`select last_at from private.player_ip where uid = '${ANNA}';`);
const s1 = settle(ANNA, { headers: xff('203.0.113.7') });
check('the beat from the same address soon after writes nothing',
  !s1.err && ips(ANNA) === '203.0.113.7:1'
    && psql(`select last_at from private.player_ip where uid = '${ANNA}';`) === firstAt, s1.err || ips(ANNA));
const every = psql(`select extract(epoch from private.ip_note_every())::int;`);
psql(`update private.player_ip set last_at = now() - private.ip_note_every() - interval '1 second', first_at = now() - interval '1 day' where uid = '${ANNA}';`);
settle(ANNA, { headers: xff('203.0.113.7') });
check(`a beat after ${every} s writes it again`,
  ips(ANNA) === '203.0.113.7:2'
    && psql(`select last_at > now() - interval '1 minute' and first_at < now() - interval '23 hours' from private.player_ip where uid = '${ANNA}';`) === 't',
  ips(ANNA));
settle(ANNA, { headers: xff('2001:db8::5') });
check('a beat from a new address notes it at once', ips(ANNA) === '203.0.113.7:2,2001:db8::5:1', ips(ANNA));
settle(ANNA, { headers: { 'x-forwarded-for': '198.51.100.1', 'cf-connecting-ip': '192.0.2.44' } });
check('cf-connecting-ip, when the edge sets it, before x-forwarded-for', ips(ANNA).includes('192.0.2.44:1') && !ips(ANNA).includes('198.51.100.1'), ips(ANNA));

const j2 = join(BERT);
check('a join with no headers makes the body and notes nothing', j2.out === 'true' && ips(BERT) === '', j2.err || ips(BERT));
const j3 = join(CARL, { headers: { 'x-forwarded-for': 'not-an-address' } });
check('a header that is not an address: body made, nothing noted', j3.out === 'true' && ips(CARL) === '', j3.err || ips(CARL));
const s2 = settle(BERT);
check('a beat with no headers is answered and notes nothing', !s2.err && ips(BERT) === '', s2.err);

const keep = psql(`select extract(day from private.ip_keep())::int;`);
psql(`
insert into private.player_ip (uid, ip, first_at, last_at) values
  ('${BERT}', '192.0.2.200', now() - private.ip_keep() - interval '30 days', now() - private.ip_keep() - interval '1 hour'),
  ('${BERT}', '192.0.2.201', now() - private.ip_keep(), now() - private.ip_keep() + interval '1 day');
update keeper set swept_at = now() - interval '1 day' where one;
select world_tick() \\g /dev/null
`);
check(`the clock forgets an address unseen for ${keep} days and keeps a younger one`, ips(BERT) === '192.0.2.201:1', ips(BERT));

/* ---- new bodies per connection ------------------------------------------------ */
console.log('--- new bodies per connection');
const CAP = Number(psql('select private.ip_body_cap();'));
const HOURS = Number(psql('select extract(epoch from private.ip_body_window())::int / 3600;'));
const CROWD = '198.51.100.9';
check('the browser says the same cap as the island', CAP === NEW_BODIES_A_DAY, `island ${CAP}, browser ${NEW_BODIES_A_DAY}`);
const makers = [DORA, EMIL, FINN];
check('the cap is three in 24 h', CAP === 3 && HOURS === 24 && makers.length === CAP, `${CAP} in ${HOURS} h`);
const made = makers.map((u) => join(u, { headers: xff(CROWD) }));
check(`${CAP} new bodies from one connection are made`, made.every((r) => r.out === 'true' && !r.err),
  made.map((r) => r.err || r.out).join(' | '));
const over = join(GRETA, { headers: xff(CROWD) });
const REFUSAL = new RegExp(`^New bodies: ${CAP} per connection per ${HOURS} h\\. Next in \\d+ (days?|hours?|minutes?)( and \\d+ (hours?|minutes?))?\\.$`);
const said = over.err.replace(/^.*ERROR:\s+/s, '').split('\n')[0];
check('the next is refused in one line, with when the next may be', REFUSAL.test(said), over.err || over.out);
check('and no body is made, and nothing noted against the connection', !hasBody(GRETA)
  && psql(`select count(*) from private.ip_body where ip = '${CROWD}';`) === String(CAP));
const elsewhere = join(GRETA, { headers: xff('198.51.100.10') });
check('the same account from another connection is let in', elsewhere.out === 'true', elsewhere.err || elsewhere.out);
const back = join(DORA, { headers: xff(CROWD) });
check('coming back to a body from the full connection is never refused', back.out === 'false' && !back.err, back.err || back.out);
const keeper = join(FOUNDER, { headers: xff(CROWD) });
check('a keeper of the island is never capped', keeper.out === 'true' && !keeper.err, keeper.err || keeper.out);
psql(`update private.ip_body set at = at - private.ip_body_window() where ip = '${CROWD}';`);
const later = join(HUGO, { headers: xff(CROWD) });
check(`after ${HOURS} h the connection may make one again`, later.out === 'true', later.err || later.out);
psql(`update keeper set swept_at = now() - interval '1 day' where one; select world_tick() \\g /dev/null`);
check('and the clock forgets bodies older than the window',
  psql(`select count(*) from private.ip_body where ip = '${CROWD}';`) === '1');
const unknown = join(IDA);
check('with no address there is no cap', unknown.out === 'true', unknown.err || unknown.out);

/* ---- keeper doors and the second step ----------------------------------------- */
console.log('--- the second step');
const DOORS: Array<[string, string]> = [
  ['who is on', `select rpc_owner_online('${ROCK}') is not null;`],
  ['mute', `select rpc_owner_mute('${ROCK}', '${BERT}', 60) is not null;`],
  ['unmute', `select rpc_owner_unmute('${ROCK}', '${BERT}') is not null;`],
  ['move', `select rpc_owner_move('${ROCK}', '${BERT}') is not null;`],
  ['clear', `select rpc_owner_clear('${ROCK}', 3, 3) is not null;`],
];
const opens = (who: string, o: As): string[] => DOORS.map(([door, call]) => {
  const r = as(who, call, o);
  return r.err ? `${door}: ${r.err.replace(/^.*ERROR:\s+/s, '').split('\n')[0]}` : `${door}: open`;
});
const allOpen = (xs: string[]): boolean => xs.every((x) => x.endsWith(': open'));
const allCode = (xs: string[]): boolean => xs.every((x) => x.endsWith(`: ${KEEPER_CODE}`));
const amI = (who: string, o: As): string => as(who, `select rpc_owner_am_i('${ROCK}');`, o).out;

const plain = opens(FOUNDER, { aal: 'aal1' });
check('a keeper with no second factor: every door open at aal1', allOpen(plain), plain.join(' | '));
psql(`insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status)
      values ('ac000000-0000-4000-8000-00000000f001', '${FOUNDER}', 'Wildermon', 'totp', 'unverified');`);
const half = opens(FOUNDER, { aal: 'aal1' });
check('an unverified factor does not count', allOpen(half), half.join(' | '));
psql(`update auth.mfa_factors set status = 'verified' where user_id = '${FOUNDER}';`);
const logged = psql(`select count(*) from private.owner_log where world_id = '${ROCK}';`);
const low = opens(FOUNDER, { aal: 'aal1' });
check('a verified factor: every door refuses aal1, in the browser\'s words', allCode(low), low.join(' | '));
const none = opens(FOUNDER, {});
check('and a token with no aal', allCode(none), none.join(' | '));
check('and the refusal comes before anything is done or written down',
  psql(`select count(*) from private.island_mute where world_id = '${ROCK}';`) === '0'
    && psql(`select count(*) from private.owner_log where world_id = '${ROCK}';`) === logged, logged);
const high = opens(FOUNDER, { aal: 'aal2' });
check('aal2 opens every door', allOpen(high), high.join(' | '));
check('asking whether you keep the island still answers at aal1', amI(FOUNDER, { aal: 'aal1' }) === 't', amI(FOUNDER, { aal: 'aal1' }));
psql(`insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status)
      values ('ac000000-0000-4000-8000-00000000f002', '${ANNA}', 'Wildermon', 'totp', 'verified');`);
const stranger = opens(ANNA, { aal: 'aal2' });
check('somebody who keeps nothing is refused as before, even at aal2',
  stranger.every((x) => x.endsWith(': only a keeper of this island may do that')), stranger.join(' | '));
const stranger1 = opens(ANNA, { aal: 'aal1' });
check('and at aal1 is told nothing about codes', stranger1.every((x) => x.endsWith(': only a keeper of this island may do that')),
  stranger1.join(' | '));
const ungated = psql(`
select coalesce(string_agg(p.proname, ', '), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'rpc\\_owner\\_%' and p.proname <> 'rpc_owner_am_i'
   and pg_get_functiondef(p.oid) not like '%private.keeper_code_ok(me)%';`);
check('every keeper door there is carries the rule', ungated === '', ungated);

/* ---- out of reach -------------------------------------------------------------- */
console.log('--- out of reach');
for (const table of ['private.player_ip', 'private.ip_body']) {
  const r = as(ANNA, `select count(*) from ${table};`);
  check(`${table} cannot be read from a browser`, r.err.includes('permission denied'), r.err || r.out);
}
const helpers = psql(`
select coalesce(string_agg(p.proname, ', ' order by p.proname), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private' and p.proname in ('client_ip', 'note_ip', 'ip_body_take', 'keeper_code_ok', 'ip_body_cap', 'ip_keep')
   and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'));`);
check('and none of the helpers can be called from one', helpers === '', helpers);
check('nobody signed in may not join', anon(`select rpc_join('${ROCK}', 'x');`).err.includes('permission denied'));

/* ---- what the beat costs ------------------------------------------------------- */
console.log('--- cost');
const timed = sql(`
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.7, 10.0.0.1"}', false) \\g /dev/null
create function pg_temp.cost() returns numeric language plpgsql as $$
declare t0 timestamptz; i int;
begin
  perform private.note_ip('${ANNA}');
  t0 := clock_timestamp();
  for i in 1..2000 loop perform private.note_ip('${ANNA}'); end loop;
  return round((extract(epoch from clock_timestamp() - t0) * 1e6 / 2000)::numeric, 1);
end $$;
select pg_temp.cost();`);
const us = timed.err ? undefined : timed.out;
console.log(`noting a known address on the beat: ${us ?? '?'} µs a call`);
check('noting a known address costs under half a millisecond', us !== undefined && Number(us) < 500, `${us} µs`);

psql(CLEAN);
for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`accounts — ${ok.length} of ${ok.length}`);
