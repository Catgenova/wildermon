/**
 * A settlement's stores are read off the settlement, and fast, whatever else stands on the island.
 *
 * Reported: "The server isnt loading now". Every round of the world clock ran into its 120-second statement timeout
 * inside a hod carrier's choice of wall: `deed_store_items` reckoned what every piece of furniture on the island
 * could hold before asking whether it stood on the keeper's settlement, and `wall_needing_stocked` ran it once for
 * every planned wall and every material each wanted. Asked here, on an island with three thousand stocked chests
 * about the island, thirty more on the settlement and sixty-one planned walls:
 *
 *   * the stores read are exactly the keeper's: every crate and piece of furniture on one of their settlements that
 *     holds anything (`on_my_deed`, `furniture_holds`), and nothing else;
 *   * the hod still takes the wall that wants what the stores hold, and the store nearest it;
 *   * and twenty of each choice take well under the clock's budget, where they took eighty seconds.
 *
 * Makes its own island and rolls it back.
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

/** Twenty of each choice, in milliseconds, may take this long; the old reading took about 80,000. */
const BUDGET_MS = 2000;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '7e5b0000-0000-4000-8000-000000000f01'; i int; v_chest bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Storesread', 183, 400, 200, 200, true) returning id into w;
  perform land_blank(w, 400);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mason');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Readstead', 200, 200, 15, 3, u);
  for i in 1..3000 loop
    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
      values (w, 'furniture', 'chest', (i * 37) % 400, (i * 53) % 400, 0, 0, ((i * 37) % 400) + 0.375, ((i * 53) % 400) + 0.375, 40, u)
      returning id into v_chest;
    insert into item (world_id, holder, placed, def, ql, count)
      values (w, 'furniture', v_chest, case when i % 2 = 0 then 'mortar' else 'stone_brick' end, 30, 5);
  end loop;
  for i in 1..30 loop
    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
      values (w, 'furniture', 'chest', 190 + i % 10, 190 + i / 10, 0, 0, 190.375 + i % 10, 190.375 + i / 10, 40, u)
      returning id into v_chest;
    insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_chest, 'marble_brick', 30, 5);
  end loop;
  insert into building (world_id, id, name, planned_by) values (w, 1, 'Hall', u);
  for i in 1..60 loop
    insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
      values (w, 0, 'h', 195 + i % 12, 205 + i / 12, 1, 'solid', 'log', wall_bill('log', 'solid'), wall_bill('log', 'solid'), u);
  end loop;
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
    values (w, 0, 'h', 210, 210, 1, 'solid', 'marble', wall_bill('marble', 'solid'), wall_bill('marble', 'solid'), u);
  perform set_config('my.w', w::text, true);
  perform set_config('my.u', u::text, true);
end $t$;
-- As the live island's planner sees it: with the tables counted.
analyze item; analyze placed; analyze wall; analyze crate;
do $t$
declare v_w uuid := current_setting('my.w')::uuid; v_u uuid := current_setting('my.u')::uuid; t0 timestamptz; i int; r record;
begin
  -- The stores, against what the rule says they are.
  insert into said select 'READ', count(*) || '|' || count(distinct s.sid) from deed_store_items(v_w, v_u) s;
  insert into said select 'RULE', count(*) || '|' || count(distinct p.id)
    from placed p join furniture_def fd on fd.id = p.sub join item i on i.placed = p.id and i.holder = 'furniture'
   where p.world_id = v_w and p.kind = 'furniture' and furniture_holds(p) and coalesce(fd.trash, 0) = 0 and on_my_deed(v_w, v_u, p.x, p.y);
  insert into said select 'SAME', count(*)::text from (
    (select s.sid from deed_store_items(v_w, v_u) s except
     select p.id from placed p join item i on i.placed = p.id and i.holder = 'furniture'
      where p.world_id = v_w and p.kind = 'furniture' and furniture_holds(p) and on_my_deed(v_w, v_u, p.x, p.y))
    union all
    (select p.id from placed p join item i on i.placed = p.id and i.holder = 'furniture'
      where p.world_id = v_w and p.kind = 'furniture' and furniture_holds(p) and on_my_deed(v_w, v_u, p.x, p.y) except
     select s.sid from deed_store_items(v_w, v_u) s)) d;
  t0 := clock_timestamp();
  for i in 1..20 loop select * into r from wall_needing_stocked(v_w, v_u, 200, 200, 15); end loop;
  insert into said values ('WALL', r.item || '|' || r.x || '|' || r.y || '|' || round(extract(epoch from clock_timestamp() - t0)::numeric * 1000));
  t0 := clock_timestamp();
  for i in 1..20 loop select * into r from store_holding(v_w, v_u, array['marble_brick'], 210.5, 210.5); end loop;
  insert into said values ('STORE', r.kind || '|' || r.x || '|' || r.y || '|' || round(extract(epoch from clock_timestamp() - t0)::numeric * 1000));
end $t$;
select k || '=' || v from said;
rollback;
`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => l.split('=') as [string, string]));
check('the stores read are the ones on the settlement, not the island\'s three thousand', Number((said.get('READ') ?? '').split('|')[0]) >= 30 && Number((said.get('READ') ?? '').split('|')[0]) < 100, said.get('READ'));
check('the same as the rule counts them', said.get('READ') === said.get('RULE'), `${said.get('READ')} against ${said.get('RULE')}`);
check('and the same pieces, none missing and none extra', said.get('SAME') === '0', said.get('SAME'));
{
  const [item, x, y, ms] = (said.get('WALL') ?? '').split('|');
  check('the hod takes the marble wall, which wants what the stores hold', item === 'marble_brick' && x === '210' && y === '210', said.get('WALL'));
  check(`twenty choices of wall take under ${BUDGET_MS} ms`, Number(ms) < BUDGET_MS, `${ms} ms`);
}
{
  const [kind, x, y, ms] = (said.get('STORE') ?? '').split('|');
  check('and goes to the store nearest it holding marble', kind === 'furniture' && x === '199' && y === '192', said.get('STORE'));
  check(`twenty choices of store take under ${BUDGET_MS} ms`, Number(ms) < BUDGET_MS, `${ms} ms`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na settlement's stores are read off the settlement — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
