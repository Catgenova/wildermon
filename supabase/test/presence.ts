/**
 * Logged on and logged off, said to everybody.
 *
 * Asked for: "Add a banner like when entering a deed when a player logs on or
 * off. Add a text line in Talk when a player logs on or off." Asked of both
 * sides:
 *
 *   * somebody new washing ashore, and somebody away coming back, each say
 *     "Logged on: <name>" to the whole island, once;
 *   * a step, which writes `away = false` over and over, says nothing more;
 *   * left idle past the island's limit, `log_out_idle` says "Logged off:
 *     <name>" once, and its old "has gone home." line is gone;
 *   * every line is kind `presence` and to nobody in particular, and the
 *     browser reads who and which out of each one as the island wrote it.
 *
 * The island half runs against the database the suite leaves behind, in one
 * transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { presenceOf } from '../../src/net/presence';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; b uuid := '33333333-4444-5555-6666-777777777777'; v_from bigint;
begin
  select id into w from world where name = 'Bigness';
  select coalesce(max(n), 0) into v_from from event where world_id = w;
  insert into player (world_id, uid, name, x, y) values (w, b, 'Tova', 100.5, 100.5);
  insert into said values ('ashore', (select string_agg(text || '|' || kind || '|' || coalesce(uid::text, 'all'), ';' order by n)
    from event where world_id = w and n > v_from));

  select coalesce(max(n), 0) into v_from from event where world_id = w;
  update player set away = false, seen_at = now() where world_id = w and uid = b;
  update player set away = false, seen_at = now() where world_id = w and uid = b;
  insert into said values ('steps', (select count(*)::text from event where world_id = w and n > v_from));

  update player set seen_at = now() - interval '1 day' where world_id = w and uid = b;
  perform log_out_idle(w);
  insert into said values ('idle', (select string_agg(text || '|' || kind, ';' order by n)
    from event where world_id = w and n > v_from and text like '%Tova%'));
  insert into said values ('away', (select away::text from player where world_id = w and uid = b));

  select coalesce(max(n), 0) into v_from from event where world_id = w;
  update player set away = false, seen_at = now() where world_id = w and uid = b;
  insert into said values ('back', (select string_agg(text, ';' order by n) from event where world_id = w and n > v_from));
end $$;
select k || '=' || coalesce(v, 'nothing') from said order by k;
rollback;
`);
const island = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

check('washed ashore: logged on, to everybody, once', island.get('ashore') === 'Logged on: Tova|presence|all', island.get('ashore'));
check('a step says nothing more', island.get('steps') === '0', island.get('steps'));
check('left idle: logged off, once, and no "has gone home."', island.get('idle') === 'Logged off: Tova|presence', island.get('idle'));
check('and away', island.get('away') === 'true', island.get('away'));
check('back again: logged on', island.get('back') === 'Logged on: Tova', island.get('back'));
const on = presenceOf((island.get('ashore') ?? '').split('|')[0]);
const off = presenceOf((island.get('idle') ?? '').split('|')[0]);
check('the browser reads who and which out of the island\'s lines',
  on?.name === 'Tova' && on.on === true && off?.name === 'Tova' && off.on === false, JSON.stringify([on, off]));
check('and nothing out of any other line', presenceOf('Tova has gone home.') === null && presenceOf('<Tova> Logged on: x') === null);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`logged on and off, said to everybody — ${ok.length} of ${ok.length}`);
