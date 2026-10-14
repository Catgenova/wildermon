/**
 * A corner the island moves is said to the browsers watching.
 *
 * A slab breaking away while mining lowered a corner on the island and told
 * nobody, so it showed only after a refresh; a corner chipped back and dirt
 * dropped at your feet were the same. This asks that each of the three
 * announces the four tiles sharing the corner, with the corner's new height,
 * and that the announcement reaches no tile it should not.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';

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
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const MIRA = 'c0e7e000-0000-4000-8000-0000000000a1';

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; h0 int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Corners', 165, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 20.3, y = 20.4 where world_id = w and uid = u;
  perform give(w, u, 'dirt', 1, 20);
  h0 := land_height(w, 20, 20);
  delete from tile_change where world_id = w;
  perform perform_terrain(w, u, 'drop_dirt_here', jsonb_build_object('kind', 'item', 'uid', null));
  insert into said values ('RAISED', (land_height(w, 20, 20) - h0)::text);
  -- Every tile told, and the corner each one carries for (20, 20): the tile at (20,20) has it first, (19,20) second, (19,19) third, (20,19) fourth.
  insert into said select 'TOLD', string_agg(x || ',' || y || ':' ||
      (case when x = 20 and y = 20 then corners[1] when x = 19 and y = 20 then corners[2]
            when x = 19 and y = 19 then corners[3] else corners[4] end)::text, ' ' order by y, x)
    from tile_change where world_id = w;
  insert into said values ('H', land_height(w, 20, 20)::text);
  -- At the island's edge, only the tiles that are on it.
  delete from tile_change where world_id = w;
  perform land_announce_corner(w, 0, 0);
  insert into said select 'EDGE', string_agg(x || ',' || y, ' ' order by y, x) from tile_change where world_id = w;
  -- And the two the island rolls or works itself, mining's slab and a chipped corner.
  insert into said values ('MINE', (select count(*) from regexp_matches(pg_get_functiondef('perform_terrain'::regproc), 'land_announce_corner', 'g'))::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

// The tile under your feet is told twice when the dirt covers it as well, which is harmless: the set is what counts.
const told = [...new Set((isle.get('TOLD') ?? '').split(' ').filter(Boolean))];
const h = isle.get('H') ?? '';
check('dirt dropped at your feet raises the corner', isle.get('RAISED') === '1', isle.get('RAISED') ?? '');
check('and all four tiles sharing it are told, each with the corner\'s new height',
  told.length === 4 && ['19,19', '20,19', '19,20', '20,20'].every((t) => told.some((s) => s.startsWith(`${t}:`)))
    && told.every((s) => s.split(':')[1] === h), `${isle.get('TOLD')} (height ${h})`);
check('at the edge of the island, only the tile that is on it', isle.get('EDGE') === '0,0', isle.get('EDGE') ?? '');
check('a slab breaking away while mining, a chipped corner and dirt dropped all announce their corner',
  isle.get('MINE') === '3', `${isle.get('MINE')} of 3`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na corner moved is said — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
