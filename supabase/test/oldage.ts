/**
 * Life stages on the seasons' scale, and death of old age.
 *
 * Asked for: "Scale life stages to match the 90-day seasons. 90d days at old and the wildermon dies of old age. Any
 * wildermon currently Old set to grown." Young and old come at the seasons' scale (`AGE_SCALE`), and `OLD_FOR` after
 * turning old a wildermon dies (`old_age_sweep`, asked by `world_tick`'s tidy round).
 *
 * Asks that the three numbers are the browser's on the island; that the browser reads the stages off them; and, on
 * the island in a rolled-back transaction, that one past its old age dies, leaves a carcass and its keeper is told on
 * the Wildermon tab, and that one old but not yet past it lives.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on it.
 */
import { execFileSync } from 'node:child_process';
import { AGE_SCALE, ageOf, OLD_AT, OLD_FOR, REAL_DAY, YOUNG_FOR, type Creature } from '../../src/game/creatures';
import { SEASON_DAYS, SHORT_SEASON_DAYS } from '../../src/world/calendar';

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

/* ---- the browser ----------------------------------------------------------- */

check(`stages are scaled with the seasons, ×${AGE_SCALE}`, AGE_SCALE === SEASON_DAYS / SHORT_SEASON_DAYS);
check(`old age lasts 90 days (${OLD_FOR} s)`, OLD_FOR === 90 * REAL_DAY);
const at = (lived: number): string => ageOf({ born: 1000, kept: null } as unknown as Creature, 1000 + lived);
check('young until YOUNG_FOR, grown until OLD_AT, old after', at(YOUNG_FOR - 1) === 'young' && at(YOUNG_FOR + 1) === 'grown'
  && at(OLD_AT - 1) === 'grown' && at(OLD_AT + 1) === 'old', `${at(YOUNG_FOR - 1)} ${at(YOUNG_FOR + 1)} ${at(OLD_AT - 1)} ${at(OLD_AT + 1)}`);

/* ---- the island ------------------------------------------------------------ */

const out = psql(`
begin;
create temp table said (k text, v text);
insert into said values ('DEFS', young_for()::text || '|' || old_at()::text || '|' || old_for()::text);
insert into said values ('TICK', (pg_get_functiondef('world_tick'::regproc) like '%perform old_age_sweep(w.id);%')::text);
do $$
declare w uuid; me uuid; v_old int; v_spent int; v_gone int;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  v_old := creature_spawn(w, 'sparra', 10.5, 10.5, 'active', now() - interval '60 days');
  v_spent := creature_spawn(w, 'sparra', 12.5, 10.5, 'active', now() - interval '60 days');
  update creature set keeper = me, name = 'Elder' where world_id = w and id = v_old;
  update creature set keeper = me, name = 'Spent' where world_id = w and id = v_spent;
  update creature cr set born = now() - make_interval(secs => (old_of(cr) + 60) / age_pace(cr)) where world_id = w and id = v_old;
  update creature cr set born = now() - make_interval(secs => (old_of(cr) + old_for() + 60) / age_pace(cr)) where world_id = w and id = v_spent;
  insert into said values ('AGES', (select age_of(cr.born, old_of(cr), age_pace(cr)) from creature cr where world_id = w and id = v_old));
  delete from item where world_id = w and holder = 'ground' and def = 'corpse';
  v_gone := old_age_sweep(w);
  insert into said values ('GONE', v_gone::text || '|' || exists (select 1 from creature where world_id = w and id = v_spent)::text
    || '|' || exists (select 1 from creature where world_id = w and id = v_old)::text);
  insert into said values ('TOLD', coalesce((select e.kind || ':' || e.text from event e where e.world_id = w and e.uid = me
    and e.text like 'Spent %' order by e.n desc limit 1), 'nothing'));
  insert into said values ('CORPSE', (select count(*) from item where world_id = w and holder = 'ground' and def = 'corpse')::text);
end $$;
select k || '=' || v from said;
rollback;
`);
const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) said.set(line.slice(0, i), line.slice(i + 1));
}
const island = (k: string): string => said.get(k) ?? 'MISSING';

check('young_for, old_at and old_for are the browser\'s on the island', island('DEFS') === `${YOUNG_FOR}|${OLD_AT}|${OLD_FOR}`, island('DEFS'));
check('the world\'s tidy round asks for the old age sweep', island('TICK') === 'true', island('TICK'));
check('one a minute into old age is old', island('AGES') === 'old', island('AGES'));
check('the sweep takes the one past its old age and leaves the one in it', island('GONE') === '1|false|true', island('GONE'));
check('its keeper is told on the Wildermon tab', island('TOLD') === 'wildermon:Spent died of old age.', island('TOLD'));
check('and it leaves its carcass where it stood', Number(island('CORPSE')) === 1, island('CORPSE'));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`old age — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
