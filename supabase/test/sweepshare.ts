/**
 * Every awake player gets a share of the round.
 *
 * Reported: "Mortarbacks still not working when I log in", their card saying nobody awake was near with their keeper
 * beside them: the clock was not settling them. `world_tick` settles what is round each awake player's tile in turn
 * and stops at the round's budget; the tiles went in the same order every round, so a first player's country full of
 * wildlife coming due spent the whole budget, round after round, and nothing near the players after them was settled.
 *
 * Asks, in a rolled-back transaction on Hoarding with every other body away and the budget cut to `BUDGET_MS`: with
 * `FLOOD` wild things an hour overdue round one player (each about 28 ms to settle) and a companion long overdue beside another, one round of the clock
 * settles the companion as well as some of the wild, every round, however long the wild take; that the wildermon of
 * everybody awake are settled first, on a budget of their own (`kept_sweep`); and that a sweep takes the tame before
 * the wild.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';

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

const FLOOD = 300;
const BUDGET_MS = 40;
const ROUNDS = 6;

const out = psql(`
begin;
create temp table said (k text, v text);
create or replace function settle_budget() returns interval language sql immutable as $$ select interval '${BUDGET_MS} milliseconds' $$;
do $t$
declare w uuid; a uuid := 'a1a1a1a1-0000-4000-8000-000000000001'; b uuid := 'b2b2b2b2-0000-4000-8000-000000000002';
        k int; i int; r int; v_before timestamptz; v_after timestamptz; v_wild int := 0; v_got int := 0; v_ticked jsonb;
begin
  select id into w from world where name = 'Hoarding';
  update player set away = true;
  insert into player (world_id, uid, name, x, y) values (w, a, 'Westerly', 8.5, 8.5), (w, b, 'Easterly', 58.5, 58.5);
  update player set away = false, seen_at = now() where world_id = w and uid in (a, b);
  for i in 1 .. ${FLOOD} loop
    perform creature_spawn(w, 'rabba', 3.5 + (i % 11), 3.5 + (i / 11) % 11, 'wild', now() - interval '60 days');
  end loop;
  update creature set until = now() - interval '1 hour' where world_id = w and mode = 'wild';
  -- Each round, a companion of the east one's long overdue again, and does the round settle it?
  k := creature_spawn(w, 'rabba', 58.5, 58.5, 'active', now() - interval '60 days', b);
  for r in 1 .. ${ROUNDS} loop
    update creature set until = now() - interval '1 hour', settled_at = now() - interval '1 hour' where world_id = w and id = k;
    update creature set until = now() - interval '1 hour', settled_at = now() - interval '1 hour' where world_id = w and mode = 'wild' and to_x < 20;
    select until into v_before from creature where world_id = w and id = k;
    perform pg_advisory_unlock_all();
    v_ticked := world_tick();
    select until into v_after from creature where world_id = w and id = k;
    if v_after > v_before then v_got := v_got + 1; end if;
    v_wild := v_wild + (v_ticked->>'stirred')::int - case when v_after > v_before then 1 else 0 end;
  end loop;
  insert into said values ('GOT', v_got::text), ('WILD', v_wild::text), ('TICK', v_ticked::text);
end $t$;
insert into said values ('ORDER', (pg_get_functiondef('creature_sweep'::regproc) like '%order by mode = ''wild'', until limit 120%')::text);
insert into said values ('KEPT', (position('kept_sweep(w.id, clock_timestamp() + settle_budget())' in pg_get_functiondef('world_tick'::regproc))
  between 1 and position('v_share := least(v_deadline,' in pg_get_functiondef('world_tick'::regproc)))::text);
insert into said values ('SHARE', (pg_get_functiondef('world_tick'::regproc) like '%v_share := least(v_deadline,%')::text);
select k || '=' || v from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const say = (k: string): string => said.get(k) ?? 'unsaid';

check('a sweep takes the tame before the wild', say('ORDER') === 'true', say('ORDER'));
check('first, the wildermon of everybody awake, on a budget of their own (kept_sweep)', say('KEPT') === 'true', say('KEPT'));
check('each awake tile has a share of what is left of the round', say('SHARE') === 'true', say('SHARE'));
check(`with ${FLOOD} wild things overdue round one player and a ${BUDGET_MS} ms round, a companion beside another is settled every round (${ROUNDS})`,
  say('GOT') === String(ROUNDS), `${say('GOT')} of ${ROUNDS}; ${say('TICK')}`);
check('and the wild round the first are settled too', Number(say('WILD')) > 0, say('WILD'));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`every awake player gets a share of the round — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
