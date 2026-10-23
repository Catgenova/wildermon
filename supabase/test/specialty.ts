/**
 * Three of a trade on a settlement make it a specialty, and each of them works it faster.
 *
 * Asked for: "Three or more workers of one trade on a deed unlock a +10% bonus for that trade." With `SPECIALTY_AT` or
 * more deed workers of a trade on a settlement -- its founder's and its citizens' -- every one of them takes its task at
 * `1 + SPECIALTY_BONUS` of its pace: a go's work time is divided by it, where its stage and its blood already speed it.
 * This asks, of both sides:
 *
 *   * that the numbers are the same;
 *   * that the count is of deed workers of that trade on the settlement, a citizen's among them, and not of one at
 *     another trade, one following you, one in a crate or a wild one;
 *   * that two of a trade work at their pace and three at `1 + SPECIALTY_BONUS` of it, at a go's work time;
 *   * that the count is sent for the card, and what the settlement window and the card say;
 *   * and how long the count takes on an island with a crowd on it, which it is asked once a go.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import {
  GATHER_SKILL, GATHER_VERB, SPECIALTY_AT, SPECIALTY_BONUS, specialtyMul, specialtySays, workDuration, type Creature,
} from '../../src/game/creatures';
import { percent } from '../../src/game/words';
import { TileType } from '../../src/world/tiles';

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
const near = (a: number, b: number, by = 1e-6): boolean => Math.abs(a - b) <= by * Math.max(1, Math.abs(b));
const T = 30;
const U = '7e5b0000-0000-4000-8000-0000000000e5';
const V = '7e5b0000-0000-4000-8000-0000000000e6';
const CALLS = 500;

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v uuid := '${V}'; a int; b int; d int; c creature; r jsonb; i int; t0 timestamptz; n int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Specialty', 177, 200, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 200);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 199) x, generate_series(0, 199) y;
  perform land_set_tile(w, x, ${T + 4}, tile_id('Reed')) from generate_series(${T - 2}, ${T + 2}) x;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set body_at = now(), x = ${T} + 0.5, y = ${T} + 0.5, seen_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Reedstead', ${T}, ${T}, 10, 5, u);
  insert into deed_member (world_id, founder, uid, role) values (w, u, v, 'builder');
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 1, 'plank', ${T + 1}, ${T}, 0, 0, true, u);
  insert into said values ('NUMS', specialty_at() || ',' || specialty_bonus());

  -- Two reed cutters of yours, and the ones that do not count: a water carrier of yours, a reed cutter following you, one
  -- in a crate, a wild one.
  a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T + 3} + 0.5, 'deed', now() - interval '60 days', u);
  b := creature_spawn(w, 'sedra', ${T} + 1.5, ${T + 3} + 0.5, 'deed', now() - interval '60 days', u);
  perform creature_spawn(w, 'holla', ${T} + 2.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  perform creature_spawn(w, 'sedra', ${T} + 3.5, ${T} + 0.5, 'active', now() - interval '60 days', u);
  perform creature_spawn(w, 'sedra', ${T} + 4.5, ${T} + 0.5, 'stored', now() - interval '60 days', u);
  perform creature_spawn(w, 'sedra', ${T} + 5.5, ${T} + 0.5, 'wild', now() - interval '60 days', null);
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null,
         skills = jsonb_build_object('foraging', 10) where world_id = w and species = 'sedra';
  insert into said values ('TWO', deed_trade_workers(w, u, 'reed')::text);
  select * into c from creature where world_id = w and id = a;
  insert into said values ('PACE2', (worker_pace(w, c, 'reed') / beast_mul(c, 'work'))::text);
  -- A go's work time at two.
  update creature set phase = 'out', work_x = ${T}, work_y = ${T + 4}, until = now() - interval '0.3 seconds' where world_id = w and id = a;
  perform worker_settle(w, a);
  select * into c from creature where world_id = w and id = a;
  insert into said values ('GO2', c.phase || ',' || extract(epoch from c.until - c.leg_at) || ',' || (work_duration(task_skill(c)) / beast_mul(c, 'work')));
  -- A citizen's makes three.
  d := creature_spawn(w, 'sedra', ${T} + 2.5, ${T + 3} + 0.5, 'deed', now() - interval '60 days', v);
  update creature set traits = '{}', rare = null, care = 0, skills = jsonb_build_object('foraging', 10) where world_id = w and id = d;
  insert into said values ('THREE', deed_trade_workers(w, u, 'reed') || ',' || deed_trade_workers(w, v, 'reed'));
  select * into c from creature where world_id = w and id = a;
  insert into said values ('PACE3', (worker_pace(w, c, 'reed') / beast_mul(c, 'work'))::text);
  update creature set phase = 'out', work_x = ${T}, work_y = ${T + 4}, until = now() - interval '0.3 seconds' where world_id = w and id = a;
  perform worker_settle(w, a);
  select * into c from creature where world_id = w and id = a;
  insert into said values ('GO3', c.phase || ',' || extract(epoch from c.until - c.leg_at) || ',' || (work_duration(task_skill(c)) / beast_mul(c, 'work')));
  -- A trade nobody has made a specialty of, and one with no go to quicken.
  insert into said values ('COUNTS', deed_trade_counts(w, u)::text);
  update creature set job = 'guard' where world_id = w and id in (a, b, d);
  select * into c from creature where world_id = w and id = a;
  insert into said values ('GUARD', (worker_pace(w, c, 'guard') / beast_mul(c, 'work'))::text);
  update creature set job = null where world_id = w and id in (a, b, d);
  -- Sent for the card.
  r := rpc_creatures(w, 40);
  insert into said select 'SENT', coalesce(e->>'specialty', '') from jsonb_array_elements(r) e where (e->>'id')::int = a;

  -- And how long the count takes, asked once a go, on an island with a crowd on it: a thousand wild ones, and twenty-odd
  -- workers of yours and your citizen's.
  perform creature_spawn(w, 'rabba', 5 + (g.k % 180), 5 + (g.k / 180), 'wild', now() - interval '60 days', null) from generate_series(1, 1000) g(k);
  perform creature_spawn(w, case when g.k % 3 = 0 then 'holla' else 'sedra' end, ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days',
                         case when g.k % 2 = 0 then u else v end) from generate_series(1, 20) g(k);
  analyze creature;
  t0 := clock_timestamp();
  for i in 1 .. ${CALLS} loop n := deed_trade_workers(w, u, 'reed'); end loop;
  insert into said values ('MS', (extract(epoch from clock_timestamp() - t0) * 1000 / ${CALLS})::text || ',' || n);
  t0 := clock_timestamp();
  for i in 1 .. ${CALLS} loop r := deed_trade_counts(w, u); end loop;
  insert into said values ('MSALL', (extract(epoch from clock_timestamp() - t0) * 1000 / ${CALLS})::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check(`the numbers are the same on both sides: ${SPECIALTY_AT} workers, +${percent(SPECIALTY_BONUS)}`, at('NUMS') === `${SPECIALTY_AT},${SPECIALTY_BONUS}`, at('NUMS'));
check('on the island, two reed cutters of yours are two: not a water carrier, one following you, one crated or a wild one', at('TWO') === '2', at('TWO'));
check('and two work at their own pace', near(Number(at('PACE2')), 1), at('PACE2'));
check('a citizen\'s on the same settlement makes three, counted the same from either keeper', at('THREE') === '3,3', at('THREE'));
check(`and three work at ${1 + SPECIALTY_BONUS} of it`, near(Number(at('PACE3')), 1 + SPECIALTY_BONUS), at('PACE3'));
{
  const [p2, s2, b2] = at('GO2').split(',');
  const [p3, s3, b3] = at('GO3').split(',');
  check(`so a go at its task takes ${1 + SPECIALTY_BONUS} times less time at three than at two`,
    p2 === 'work' && p3 === 'work' && near(Number(s2), Number(b2)) && near(Number(s3), Number(b3) / (1 + SPECIALTY_BONUS)), `${at('GO2')} / ${at('GO3')}`);
}
{
  const counts = JSON.parse(at('COUNTS')) as Record<string, number>;
  check('every trade on the settlement is counted at once for the creatures read', counts.reed === 3 && counts.water === 1 && Object.keys(counts).length === 2, at('COUNTS'));
}
check('a keeping watch has no go to quicken, however many keep it', near(Number(at('GUARD')), 1), at('GUARD'));
check('the count is sent for its card', at('SENT') === '3', at('SENT'));
{
  const [ms, n] = at('MS').split(',').map(Number);
  check(`counted once a go in ${ms.toFixed(3)} ms with a thousand wild ones about and ${n} reed cutters on the settlement, well under a millisecond`, ms < 1, at('MS'));
  check(`and every trade at once, for the creatures read, in ${Number(at('MSALL')).toFixed(3)} ms`, Number(at('MSALL')) < 2, at('MSALL'));
}

/* ---- in the browser ---------------------------------------------------------------------------------------------- */

const g = Game.create(4258);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = T - 8; y <= T + 8; y++) for (let x = T - 8; x <= T + 8; x++) { g.world.setHeight(x, y, 4); g.world.setDirt(x, y, 5); g.world.setTile(x, y, TileType.Grass, 0); }
g.player.x = T + 0.5;
g.player.y = T + 0.5;
g.deed = { name: 'Reedstead', x: T, y: T, radius: 10, level: 5, mine: true };
g.rand = () => 0.5;
const cr = g.creatures as unknown as Record<string, (...a: unknown[]) => unknown>;
const call = (name: string, ...a: unknown[]): unknown => cr[name].call(g.creatures, ...a);
const spawn = (sp: string, mode: Creature['mode'] = 'deed'): Creature => {
  const c = g.creatures.spawn(sp, T + 0.5, T + 0.5, mode, g.rand, g.time - 3600 * 24 * 30);
  Object.assign(c, { traits: [], rare: 0, care: 0, hunger: 1, stance: 'passive', skills: { foraging: 10 } });
  return c;
};
const a = spawn('sedra');
spawn('sedra');
spawn('holla');
spawn('sedra', 'active');
spawn('sedra', 'wild');
check('in the browser, two reed cutters on the settlement are two', g.creatures.tradeWorkers('reed') === 2 && g.creatures.specialtyOf(a) === 2, `${g.creatures.tradeWorkers('reed')}`);
const two = g.creatures.taskMul(a, 'reed');
spawn('sedra');
const three = g.creatures.taskMul(a, 'reed');
check(`and two work at their own pace, three at ${1 + SPECIALTY_BONUS} of it`, near(two, g.creatures.workMul(a)) && near(three, two * (1 + SPECIALTY_BONUS)), `${two} ${three}`);
check('the rule is the same multiplier', specialtyMul(SPECIALTY_AT - 1) === 1 && near(specialtyMul(SPECIALTY_AT), 1 + SPECIALTY_BONUS));
{
  a.state = 'idle';
  call('beginForage', g, a, 'reed');
  check(`so a go at its task takes ${1 + SPECIALTY_BONUS} times less time at three`, near(a.until - g.time, workDuration(a.skills[GATHER_SKILL.reed]) / three), `${a.until - g.time}`);
}
{
  const list = g.creatures.specialties();
  check('the settlement window lists each trade and how many work it, most first', list.length === 2 && list[0].kind === 'reed' && list[0].n === 3 && list[1].kind === 'water' && list[1].n === 1,
    JSON.stringify(list));
}

/* ---- the words ---------------------------------------------------------------------------------------------------- */

check('a specialty says its trade, its workers and what it adds, off the rule',
  specialtySays('reed', 4) === `Specialty: ${GATHER_VERB.reed}, 4 workers: task speed +${percent(SPECIALTY_BONUS)}.`, specialtySays('reed', 4));
check('and a trade short of one says how many of how many', specialtySays('water', 1).includes(`1/${SPECIALTY_AT} workers for a specialty`), specialtySays('water', 1));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthree of a trade make a specialty — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
