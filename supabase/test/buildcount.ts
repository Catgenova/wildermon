/**
 * Building a planned piece a number of goes at a time.
 *
 * Asked for: "Allow bulk actions when building structures like walls and floors, e.g. build 5 10 25 50 instead of
 * having to click Build Wall 50x". A log wall wants sixteen logs, a log a go; twenty are carried. Asked of both sides:
 *
 *   * the row for it opens onto Fit 1, 5 and 10 and Fit all 16 (25 and 50 are more than it wants);
 *   * asked for five goes, it fits five logs and stops;
 *   * asked for fifty, it fits the eleven left, finishes the wall, and stops there.
 *
 * The island half runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { isDone } from '../../src/game/building';
import { Game } from '../../src/game/game';
import { BUILD_COUNTS, buildRow, goesLeft } from '../../src/ui/buildCounts';

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

/* ---- the browser --------------------------------------------------------- */

const game = Game.create(4242);
let spot: [number, number] | null = null;
for (let r = 0; r < 80 && !spot; r++) {
  for (let dx = -r; dx <= r && !spot; dx++) {
    for (const dy of [-r, r]) {
      const [x, y] = [64 + dx, 64 + dy];
      if (game.world.isPassable(x, y) && game.world.isPassable(x, y - 1) && !game.world.hasWater(x, y) && !game.world.hasWater(x, y - 1)) {
        spot = [x, y];
        break;
      }
    }
  }
}
const [px, py] = spot ?? [64, 64];
game.player.x = px + 0.5;
game.player.y = py + 0.5;
for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
const pack = game.inventory;
for (const it of [...pack.items]) pack.remove(it.uid, it.count);
pack.add('mallet', { ql: 50 });
pack.add('log', { ql: 30, count: 20 });
game.player.stats.stamina = 1;

const def = ACTION_BY_ID.get('build_wall')!;
const wall = game.buildings.setFence(px, py, 'n', 'solid', 'log');
const side: Target = { kind: 'tile', x: px, y: py, side: 'n' } as Target;
const LOGS = wall.total.log;

const row = buildRow(game, def, side, 'Build wall', wall, def.check?.(side, game) ?? null);
const offered = (row.children ?? []).map((c) => c.label);
const want = ['Fit 1', ...BUILD_COUNTS.filter((n) => n < LOGS).map((n) => `Fit ${n}`), `Fit all ${LOGS}`];
check(`a log wall wants ${LOGS} goes, and its row offers ${want.join(', ')}`,
  goesLeft(wall) === LOGS && offered.join('|') === want.join('|'), offered.join(', '));

/** Run the job in hand to its end, resting the body between goes so wind never stops it. */
const work = (): void => {
  for (let i = 0; i < 20000 && game.action; i++) {
    game.player.stats.stamina = 1;
    game.update(0.05);
  }
};
game.requestAction(def, side, 5);
work();
const afterFive = wall.needed.log;
game.requestAction(def, side, 50);
work();
check('in the browser: five goes fit five logs and stop', afterFive === LOGS - 5, `${LOGS - afterFive} fitted`);
check(`and fifty fit the ${LOGS - 5} left, finish the wall and stop there`,
  isDone(wall) && pack.count('log') === 20 - LOGS && !game.action, `${wall.needed.log} still needed, ${pack.count('log')} logs left`);

/* ---- the island ---------------------------------------------------------- */

const isle = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; me uuid; v_x int; v_y int; v_b int; t jsonb; i int;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  select gx, gy into v_x, v_y
    from generate_series(20, 200, 7) gx, generate_series(20, 200, 7) gy
   where not exists (select 1 from deed d where d.world_id = w
                      and abs(d.x - gx) <= d.radius + 8 and abs(d.y - gy) <= d.radius + 8)
   order by gx, gy limit 1;
  update player set x = v_x + 0.5, y = v_y + 0.5, body_at = now(), swim_at = now(), act = null, act_queue = '[]'::jsonb,
      stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1')
   where world_id = w and uid = me;
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  delete from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = me;
  perform give(w, me, 'mallet', 1, 50);
  perform give(w, me, 'log', 20, 30);

  select coalesce(max(id), 0) + 1 into v_b from building where world_id = w;
  insert into building (world_id, id, name, planned_by) values (w, v_b, 'Shed', me);
  insert into building_tile (world_id, building, x, y) values (w, v_b, v_x, v_y);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
  select w, 0, bd.dir, bd.x, bd.y, v_b, 'solid', 'log', wall_bill('log', 'solid'), wall_bill('log', 'solid'), me
    from border_of(v_x, v_y, 'n') bd;
  t := jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'side', 'n');

  -- Each ask run out to its end: the goes in hand put behind us, a few at a time, rested between.
  perform rpc_act(w, 'build_wall', t, 5);
  for i in 1 .. 20 loop
    exit when (select act from player where world_id = w and uid = me) is null;
    update player set act_ends = now() - interval '1 second', stats = jsonb_set(stats, '{stamina}', '1')
     where world_id = w and uid = me;
    perform settle(w, me);
  end loop;
  insert into said select 'FIVE', (needed->>'log') from wall w2
   where w2.world_id = w and w2.building = v_b;
  perform rpc_act(w, 'build_wall', t, 50);
  for i in 1 .. 80 loop
    exit when (select act from player where world_id = w and uid = me) is null;
    update player set act_ends = now() - interval '1 second', stats = jsonb_set(stats, '{stamina}', '1')
     where world_id = w and uid = me;
    perform settle(w, me);
  end loop;
  insert into said select 'FIFTY', (needed->>'log') || '|' || (select coalesce(sum(count), 0) from item
      where world_id = w and holder = 'player' and holder_uid = me and def = 'log')
      || '|' || coalesce((select act from player where world_id = w and uid = me), '-')
    from wall w2 where w2.world_id = w and w2.building = v_b;
end $$;
select k || '=' || v from said;
rollback;
`);
const said = new Map(isle.split('\n').filter((l) => l.includes('=')).map((l) => l.split('=') as [string, string]));
check('on the island: five goes fit five logs and stop', said.get('FIVE') === String(LOGS - 5), said.get('FIVE'));
check(`and fifty fit the ${LOGS - 5} left, finish the wall and stop there`,
  said.get('FIFTY') === `0|${20 - LOGS}|-`, said.get('FIFTY'));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nbuilding a number of goes at a time — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
