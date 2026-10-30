/**
 * A wildermon nobody has named is called what it is now.
 *
 * Reported: names still wrong after the visual overhauls -- old names showing, and stages not named for what they
 * evolved into, once tamed. On the island a creature's name changed only when it evolved by a worker's go. Now one that
 * only goes by one of its kind's own names (`kind_named`) is called its kind at its stage (`kind_name_at`) whenever it
 * is made or its skills, kind or name change (`creature_kind_name`), the browser's `kindNamed`/`kindName`; one somebody
 * named keeps the name. This asks, in a rolled-back transaction: one called by its kind's old name, one tamed already
 * evolved, one evolving by a skill that is not its trade's, and one named by its keeper.
 */
import { execFileSync } from 'node:child_process';
import { EVOLVE_AT, SPECIES } from '../../src/game/creatures';

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

const sparra = SPECIES.sparra;
const rippa = SPECIES.rippa;
const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; c int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Names', 181, 20, 10, 10, true) returning id into w;
  -- Called by its kind's old name: called its kind's name now, on any change to it.
  c := creature_spawn(w, 'sparra', 5.5, 5.5, 'wild', now() - interval '60 days');
  update creature set name = '${sparra.was![0]}' where world_id = w and id = c;
  insert into said select 'OLD', name from creature where world_id = w and id = c;
  -- Evolved by a skill that is not its trade's: its stage's name.
  update creature set skills = jsonb_build_object('fighting', ${EVOLVE_AT[1]}) where world_id = w and id = c;
  insert into said select 'EVOLVED', name from creature where world_id = w and id = c;
  -- Tamed already evolved, called by its first stage's name as it was: its stage's name.
  c := creature_spawn(w, 'sparra', 6.5, 6.5, 'wild', now() - interval '60 days');
  update creature set name = '${sparra.name}', skills = jsonb_build_object('fighting', ${EVOLVE_AT[0]}), mode = 'active' where world_id = w and id = c;
  insert into said select 'MADE', name from creature where world_id = w and id = c;
  -- Named by its keeper: kept, however it evolves.
  update creature set name = 'Biscuit' where world_id = w and id = c;
  update creature set skills = jsonb_build_object('fighting', ${EVOLVE_AT[1]}) where world_id = w and id = c;
  insert into said select 'NAMED', name from creature where world_id = w and id = c;
  -- A kind renamed by the definitions (\`species_def_renamed\`): one nobody named, a carcass and a stud book record under
  -- its old name, all called by its name now.
  c := creature_spawn(w, 'rippa', 7.5, 7.5, 'wild', now() - interval '60 days');
  update creature set name = '${rippa.was![0]}' where world_id = w and id = c;
  insert into item (world_id, holder, gx, gy, def, ql, dmg, count, extra) values (w, 'ground', 7, 7, 'corpse', 30, 0, 1, '${rippa.was![0]}');
  insert into bred_record (world_id, species, stat, value, creature_id, name, breeder, born_at)
    values (w, 'rippa', 'hardy', 1, c, '${rippa.was![0]}', null, now());
  update species_def set name = 'Testkit' where id = 'rippa';
  update species_def set was = array['${rippa.was![0]}', '${rippa.name}'] where id = 'rippa';
  insert into said select 'RENAMED', (select name from creature where world_id = w and id = c)
    || ',' || (select extra from item where world_id = w and def = 'corpse')
    || ',' || (select name from bred_record where world_id = w and species = 'rippa');
  insert into said values ('STALE', (select count(*) from creature cc where kind_named(cc) and cc.name is distinct from kind_name_at(cc))::text);
end $$;
select k || '|' || v from said;
rollback;
`);
const at = (k: string): string => out.split('\n').find((l) => l.startsWith(`${k}|`))?.slice(k.length + 1) ?? 'MISSING';

check(`one called by its kind's old name (${sparra.was![0]}) is called ${sparra.name}`, at('OLD') === sparra.name, at('OLD'));
check(`evolved by fighting to its third stage, it is called ${sparra.stages![1].name}`, at('EVOLVED') === sparra.stages![1].name, at('EVOLVED'));
check(`tamed at its second stage under its first stage's name, it is called ${sparra.stages![0].name}`, at('MADE') === sparra.stages![0].name, at('MADE'));
check('one its keeper named keeps the name as it evolves', at('NAMED') === 'Biscuit', at('NAMED'));
check(`a kind renamed by the definitions: one nobody named, a carcass and a stud book record under its old name (${rippa.was![0]}) take its name now`,
  at('RENAMED') === 'Testkit,Testkit,Testkit', at('RENAMED'));
check('and no creature on the island goes by a kind\'s name that is not its own now', at('STALE') === '0', at('STALE'));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`a wildermon is called what it is — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
