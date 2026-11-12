/**
 * Everybody ashore, read once a call (`20261103130000_everybody_ashore_read_once_a_call.sql`).
 *
 * `folk_ashore` was written as a row of `folk_row` for everybody, which asked `folk_seen` (a count of everybody
 * online) again on every row and read each person's own row five times over: the people on an island times the
 * people online, for every one of them who asks. It is one query now. This holds it to the list it was, row for row
 * and in the same order, against the old definition kept here:
 *   * on an island of 200 with 150 online, some named by their accounts, some away, one not away but unseen for a day: crowded, no places;
 *   * on the same island with five online: places sent for those online and nobody else;
 *   * on an island of one: an empty list;
 *   * and in less than half the old time over the crowded island.
 *
 * Runs against the database the suite leaves behind, and puts it back.
 */

import { psql, ok, bad, check } from './harness';
const ISLE = 'Folkashore';
const LONE = 'Folkalone';
const W = `(select id from world where name = '${ISLE}')`;
const ME = 'f01c0000-0000-4000-8000-0000000000ff';
const uid = (n: number): string => `f01c0000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// The list as it was written before, for the new one to be held to.
const OLD = `create or replace function pg_temp.folk_ashore_was(p_world uuid, p_uid uuid) returns jsonb language sql stable as $fn$
  select coalesce((select jsonb_agg(folk_row(p_world, q.uid, folk_seen(p_world))
      order by q.online desc, folk_name(p_world, q.uid))
    from (select p.uid, afoot(p_world, p.uid) as online from player p
           where p.world_id = p_world and p.uid <> p_uid
           order by afoot(p_world, p.uid) desc, p.name limit 200) q), '[]'::jsonb)
$fn$;`;

const clean = `delete from account where uid::text like 'f01c0000-%';
delete from auth.users where id::text like 'f01c0000-%';
delete from world where name in ('${ISLE}', '${LONE}');`;
psql(clean);
psql(`insert into world (name, seed, size, spawn_x, spawn_y) values ('${ISLE}', 7, 64, 32, 32), ('${LONE}', 8, 64, 32, 32);
insert into player (world_id, uid, name, x, y, away, seen_at)
  select ${W}, ('f01c0000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'Folk ' || (g % 37), 10 + (g % 40), 12 + (g % 31),
         g > 151, case when g = 151 then now() - interval '1 day' else now() - (g % 9) * interval '1 minute' end
    from generate_series(1, 200) g;
insert into player (world_id, uid, name, x, y, away, seen_at) values (${W}, '${ME}', 'Me', 5, 5, false, now());
insert into player (world_id, uid, name, x, y, away, seen_at) values ((select id from world where name = '${LONE}'), '${ME}', 'Me', 5, 5, false, now());
insert into auth.users (id) select ('f01c0000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, 200, 3) g;
insert into account (uid, name, display) select ('f01c0000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'acct' || g,
    case when g % 2 = 0 then 'Acct' || g end from generate_series(1, 200, 3) g;`);

const same = (world: string): [boolean, string] => {
  const [eq, n, xy] = psql(`${OLD}
select (folk_ashore(${world}, '${ME}') = pg_temp.folk_ashore_was(${world}, '${ME}'))::text || '|' ||
  jsonb_array_length(folk_ashore(${world}, '${ME}')) || '|' ||
  (select count(*) from jsonb_array_elements(folk_ashore(${world}, '${ME}')) e where e ? 'x');`).split('|');
  return [eq === 'true', `${n} listed, ${xy} with places`];
};

{
  const [eq, said] = same(W);
  check('crowded (150 online of 200, one more not away but unseen a day): the list it was, row for row and in order', eq && said.startsWith('200 listed, 0 '), said);
  const named = psql(`select count(*) from jsonb_array_elements(folk_ashore(${W}, '${ME}')) e where e->>'name' ilike 'acct%'`);
  check('and those with an account are named by it', named === '67', named);
}
{
  const [ms, was] = psql(`${OLD}
do $$ declare t timestamptz; a double precision := 0; b double precision := 0; i int; j jsonb; begin
  for i in 1..5 loop
    t := clock_timestamp(); j := folk_ashore(${W}, '${ME}'); a := a + extract(epoch from clock_timestamp() - t);
    t := clock_timestamp(); j := pg_temp.folk_ashore_was(${W}, '${ME}'); b := b + extract(epoch from clock_timestamp() - t);
  end loop;
  create temp table took as select a * 200 as ms, b * 200 as was;
end $$;
select round(ms::numeric, 1) || '|' || round(was::numeric, 1) from took;`).split('|').map(Number);
  check('in less than half the time it took', ms < was / 2, `${ms} ms a call against ${was}`);
}
psql(`update player set away = true where world_id = ${W} and uid::text like 'f01c0000-%' and uid not in ('${uid(1)}', '${uid(2)}', '${uid(3)}', '${uid(4)}', '${uid(5)}');`);
{
  const [eq, said] = same(W);
  check('five online: the same, places sent for those online and nobody else', eq && said === '200 listed, 5 with places', said);
}
{
  const [eq, said] = same(`(select id from world where name = '${LONE}')`);
  check('alone on an island: an empty list', eq && said.startsWith('0 listed'), said);
}
psql(clean);

for (const l of [...ok, ...bad]) console.log(l);
console.log(`\neverybody ashore, read once a call — ${ok.length} of ${ok.length + bad.length}`);
process.exit(bad.length ? 1 : 0);
