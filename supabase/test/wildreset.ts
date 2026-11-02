/**
 * Every third tree rollover, every wild wildermon goes and the island restocks.
 *
 * Asked: "Starting now, and every 3rd day on tree rollover, remove and respawn all untamed wildermon".
 *
 * Asked of the island, on an island of its own:
 *   * the number of rollovers is the browser's (`WILD_RESET_DAYS`);
 *   * a reset takes every wild one that can turn over, whatever its age, and leaves a tamed one, one in a fight and
 *     a monster; every stretch of country is owed its stocking; the rollover is kept;
 *   * an island is owed its reset with its woods done and its last reset that many rollovers ago or never, and not
 *     one rollover short of it, nor with its woods not done;
 *   * `tree_tick` resets an owed island; a player cannot call any of it.
 *
 * Everything the island does is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { WILD_RESET_DAYS } from '../../src/game/creatures';

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

const MIRA = '00000000-0000-4000-8000-0000000052e1';

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; a int; b int; t int; f1 int; f2 int; m int; v_monster text; r jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Reset', 52, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  insert into said values ('DAYS', wild_reset_days()::text);

  -- Two wild ones put out just now, a tamed one, two wild ones in a fight, a monster.
  a := creature_spawn(w, 'rabba', 10.5, 10.5, 'wild', now() - interval '3 days', null);
  b := creature_spawn(w, 'mola', 12.5, 10.5, 'wild', now() - interval '3 days', null);
  update creature set put_at = now() where world_id = w and id in (a, b);
  t := creature_spawn(w, 'rabba', 16.5, 16.5, 'active', now() - interval '60 days', u);
  f1 := creature_spawn(w, 'rabba', 20.5, 20.5, 'wild', now() - interval '3 days', null);
  f2 := creature_spawn(w, 'mola', 21.5, 20.5, 'wild', now() - interval '3 days', null);
  update creature set brawl = f2 where world_id = w and id = f1;
  update creature set brawl = f1 where world_id = w and id = f2;
  select id into v_monster from species_def where coalesce(monster, false) limit 1;
  m := creature_spawn(w, v_monster, 30.5, 30.5, 'wild', now() - interval '3 days', null);
  insert into world_stocked (world_id, bx, by, at) values (w, 0, 0, now()) on conflict do nothing;

  -- Owed: woods done, never reset; then reset, not owed; a rollover short, not owed; that many ago, owed.
  update world set trees_at = now() where id = w;
  -- Never reset counts from when the island was made: a new one keeps its first wild, an old one is owed.
  update world set made_at = now() where id = w;
  insert into said values ('DUE:NEW', wild_reset_due(w)::text);
  update world set made_at = tree_last_dawn() - make_interval(days => wild_reset_days()) where id = w;
  insert into said values ('DUE:NEVER', wild_reset_due(w)::text);
  insert into said values ('GONE', wild_reset(w)::text);
  insert into said select 'LEFT', string_agg(id::text, ',' order by id) from creature where world_id = w;
  insert into said values ('IDS', array_to_string(array[a, b, t, f1, f2, m], ','));
  insert into said select 'STOCKED', bool_and(at = '-infinity')::text from world_stocked where world_id = w;
  insert into said select 'AT', (at = tree_last_dawn())::text from private.wild_reset_at where world_id = w;
  insert into said values ('DUE:JUST', wild_reset_due(w)::text);
  update private.wild_reset_at set at = tree_last_dawn() - make_interval(days => wild_reset_days() - 1) where world_id = w;
  insert into said values ('DUE:SHORT', wild_reset_due(w)::text);
  update private.wild_reset_at set at = tree_last_dawn() - make_interval(days => wild_reset_days()) where world_id = w;
  insert into said values ('DUE:OWED', wild_reset_due(w)::text);
  update world set trees_at = tree_last_dawn() - interval '1 minute' where id = w;
  insert into said values ('DUE:WOODS', wild_reset_due(w)::text);

  -- The tree clock resets an owed island (the only owed one: every other island marked reset at this rollover).
  update world set trees_at = now() where id = w;
  insert into private.wild_reset_at (world_id, at) select id, tree_last_dawn() from world where id <> w
  on conflict (world_id) do update set at = excluded.at;
  a := creature_spawn(w, 'rabba', 10.5, 10.5, 'wild', now() - interval '3 days', null);
  update creature set put_at = now() where world_id = w and id = a;
  r := wild_reset_tick();
  insert into said values ('TICK', coalesce(r->>'gone', r::text, 'none') || '|' || (select count(*) from creature where world_id = w and id = a)::text);
  insert into said values ('DOOR', has_function_privilege('authenticated', 'wild_reset(uuid)', 'execute')::text
    || '|' || has_function_privilege('authenticated', 'wild_reset_tick()', 'execute')::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const [, , t, f1, f2, m] = at('IDS').split(',');

check('the island resets every as many rollovers as the browser says', at('DAYS') === String(WILD_RESET_DAYS), at('DAYS'));
check('an island made just now and never reset is not owed one: it keeps the wild it was stocked with', at('DUE:NEW') === 'false', at('DUE:NEW'));
check(`an island made ${WILD_RESET_DAYS} rollovers ago and never reset, its woods done, is owed one`, at('DUE:NEVER') === 'true', at('DUE:NEVER'));
check('a reset takes both wild ones put out just now', at('GONE') === '2', at('GONE'));
check('and leaves the tamed one, the two in a fight and the monster', at('LEFT') === [t, f1, f2, m].sort((x, y) => +x - +y).join(','), `${at('LEFT')} of ${at('IDS')}`);
check('every stretch of country is owed its stocking', at('STOCKED') === 'true', at('STOCKED'));
check('and the rollover is kept', at('AT') === 'true', at('AT'));
check('just reset, not owed', at('DUE:JUST') === 'false', at('DUE:JUST'));
check('a rollover short, not owed', at('DUE:SHORT') === 'false', at('DUE:SHORT'));
check(`${WILD_RESET_DAYS} rollovers on, owed`, at('DUE:OWED') === 'true', at('DUE:OWED'));
check('not before its woods are done for the day', at('DUE:WOODS') === 'false', at('DUE:WOODS'));
check('the tree clock\'s turn resets the owed island', at('TICK') === '1|0', at('TICK'));
check('a player cannot call the reset or its tick', at('DOOR') === 'false|false', at('DOOR'));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`the wild reset every third rollover — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
