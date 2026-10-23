/**
 * A deed worker that has gone an island day without a meal works at half its pace until it eats.
 *
 * Asked for: "Each worker eats from deed stores once per island day. An unfed one works at -50% and shows it on its
 * card, so food production matters." A worker eats from the stores on its settlement whenever it is hungry, as ever;
 * the seconds it has worked since its last meal are kept (`unfed`), put back to nought by any meal, and once they
 * reach `UPKEEP_FOR` (an island day, `DAY_SECONDS`) a go's work time is divided by `UNFED_PACE` until it eats. This
 * asks, of both sides:
 *
 *   * that the numbers are the same, and `UPKEEP_FOR` is the island day the ledger keeps;
 *   * that the time is counted for a worker and only while it works, and a meal out of the stores puts it back;
 *   * that with nothing it eats in the stores it goes on counting, and a hand-fed meal puts it back too;
 *   * that a day of it halves its pace at its task and a second short of the day does not, at a go's work time;
 *   * and that its card says so, with the number off the rule.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game, DAY_SECONDS } from '../../src/game/game';
import { GATHER_SKILL, UNFED_PACE, unfedNow, unfedSays, UPKEEP_FOR, workDuration, type Creature } from '../../src/game/creatures';
import { percent, timeWords } from '../../src/game/words';
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
const T = 16;
const U = '7e5b0000-0000-4000-8000-0000000000e4';

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; a int; b int; c creature; r jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Upkeep', 177, 40, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform land_set_tile(w, x, ${T + 4}, tile_id('Reed')) from generate_series(${T - 2}, ${T + 2}) x;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set body_at = now(), x = ${T} + 0.5, y = ${T} + 0.5, seen_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Upstead', ${T}, ${T}, 10, 5, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 1, 'plank', ${T + 1}, ${T}, 0, 0, true, u);
  insert into said values ('NUMS', upkeep_for() || ',' || unfed_pace() || ',' || day_seconds());

  -- A worker, not hungry, a hundred seconds since it was last settled: those are a hundred seconds unfed.
  a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null, unfed = 0,
         skills = jsonb_build_object('foraging', 10), phase = 'idle', until = now() + interval '60 seconds',
         settled_at = now() - interval '100 seconds' where world_id = w and id = a;
  perform creature_settle(w, a);
  insert into said select 'COUNTED', round(unfed::numeric, 3)::text from creature where world_id = w and id = a;
  -- One following you counts nothing.
  b := creature_spawn(w, 'sedra', ${T} + 2.5, ${T} + 0.5, 'active', now() - interval '30 days', u);
  update creature set hunger = 1, unfed = 0, settled_at = now() - interval '100 seconds' where world_id = w and id = b;
  perform creature_settle(w, b);
  insert into said select 'COMPANION', round(unfed::numeric, 3)::text from creature where world_id = w and id = b;
  delete from creature where world_id = w and id = b;
  -- Hungry, and nothing it eats in the stores: it goes on counting.
  update creature set hunger = 0.1, settled_at = now() - interval '50 seconds' where world_id = w and id = a;
  perform creature_settle(w, a);
  insert into said select 'NOFOOD', round(unfed::numeric, 3)::text from creature where world_id = w and id = a;
  -- Something it eats in the crate: it eats, and the count starts again.
  insert into item (world_id, holder, crate, gx, gy, def, ql, count) values (w, 'crate', 1, ${T + 1}, ${T}, 'wheat', 30, 2);
  update creature set hunger = 0.1, settled_at = now() - interval '50 seconds' where world_id = w and id = a;
  perform creature_settle(w, a);
  insert into said select 'ATE', round(unfed::numeric, 3)::text || ',' || (hunger > 0.5)::text from creature where world_id = w and id = a;
  -- And a hand-fed meal puts it back too (\`beast_fed\`).
  update creature set unfed = 5000 where world_id = w and id = a;
  perform beast_fed(w, a, 'wheat', 30);
  insert into said select 'HANDFED', unfed::text from creature where world_id = w and id = a;

  -- Its pace at its task: a second short of the day, and the day.
  update creature set unfed = upkeep_for() - 1 where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('PACEFED', (worker_pace(w, c, 'reed') / beast_mul(c, 'work'))::text);
  update creature set unfed = upkeep_for() where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('PACEUNFED', (worker_pace(w, c, 'reed') / beast_mul(c, 'work'))::text);
  -- And a go's work time at it: out at the reed bed, and to work.
  ${[['FED', 'upkeep_for() - 1'], ['UNFED', 'upkeep_for()']].map(([k, v]) => `
  update creature set unfed = ${v}, phase = 'out', work_x = ${T}, work_y = ${T + 4}, until = now() - interval '0.3 seconds',
         from_x = ${T} + 0.5, from_y = ${T + 3} + 0.5, to_x = ${T} + 0.5, to_y = ${T + 3} + 0.5, settled_at = now()
   where world_id = w and id = a;
  perform worker_settle(w, a);
  select * into c from creature where world_id = w and id = a;
  insert into said values ('GO${k}', c.phase || ',' || extract(epoch from c.until - c.leg_at) || ',' || (work_duration(task_skill(c)) / beast_mul(c, 'work')));`).join('')}
  -- Its card is told.
  r := rpc_creatures(w, 40);
  insert into said select 'SENT', coalesce(e->>'unfed', '') from jsonb_array_elements(r) e where (e->>'id')::int = a;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check(`the numbers are the same on both sides, and the day is the island day the ledger keeps: ${UPKEEP_FOR} seconds, ${UNFED_PACE} of its pace`,
  at('NUMS') === `${UPKEEP_FOR},${UNFED_PACE},${DAY_SECONDS}` && UPKEEP_FOR === DAY_SECONDS, at('NUMS'));
check('on the island, a worker counts the seconds it works since it last ate', at('COUNTED') === '100.000', at('COUNTED'));
check('and one following you counts none', at('COMPANION') === '0.000', at('COMPANION'));
check('hungry, with nothing it eats in the stores on the settlement, it goes on counting', at('NOFOOD') === '150.000', at('NOFOOD'));
check('with something it eats there, it eats when it is hungry and the count starts again', at('ATE') === '0.000,true', at('ATE'));
check('and a meal from your hand puts it back too', at('HANDFED') === '0', at('HANDFED'));
check(`a second short of the day it works at its full pace, and at the day at ${UNFED_PACE} of it`,
  near(Number(at('PACEFED')), 1) && near(Number(at('PACEUNFED')), UNFED_PACE), `${at('PACEFED')} / ${at('PACEUNFED')}`);
{
  const [p1, fed, base] = at('GOFED').split(',').map((x, i) => (i ? Number(x) : x)) as [string, number, number];
  const [p2, unfed] = at('GOUNFED').split(',').map((x, i) => (i ? Number(x) : x)) as [string, number];
  check(`so a go at its task takes it ${1 / UNFED_PACE} times as long, unfed`, p1 === 'work' && p2 === 'work' && near(fed, base) && near(unfed, base / UNFED_PACE),
    `${at('GOFED')} / ${at('GOUNFED')}`);
}
check('and its card is told how long it has gone', Number(at('SENT')) === UPKEEP_FOR, at('SENT'));

/* ---- in the browser ---------------------------------------------------------------------------------------------- */

const g = Game.create(4257);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = T - 8; y <= T + 8; y++) for (let x = T - 8; x <= T + 8; x++) { g.world.setHeight(x, y, 4); g.world.setDirt(x, y, 5); g.world.setTile(x, y, TileType.Grass, 0); }
for (let x = T - 2; x <= T + 2; x++) g.world.setTile(x, T + 4, TileType.Reed, 0);
g.player.x = T + 0.5;
g.player.y = T + 0.5;
g.deed = { name: 'Upstead', x: T, y: T, radius: 10, level: 5, mine: true };
g.crates.clear();
const crate = g.addCrate('plank', T + 1, T, 0, 0, [], true);
g.rand = () => 0.5;
const cr = g.creatures as unknown as Record<string, (...a: unknown[]) => unknown>;
const call = (name: string, ...a: unknown[]): unknown => cr[name].call(g.creatures, ...a);
const c: Creature = g.creatures.spawn('sedra', T + 0.5, T + 0.5, 'deed', g.rand, g.time - 3600 * 24 * 30);
Object.assign(c, { traits: [], rare: 0, care: 0, hunger: 1, stance: 'passive', skills: { foraging: 10 }, unfed: 0 });
call('updateWorker', c, 0.25, g);
check('in the browser, a worker counts the seconds it works since it last ate', near(c.unfed ?? 0, 0.25), `${c.unfed}`);
c.hunger = 0.1;
c.searchAt = 0;
call('updateWorker', c, 0.25, g);
check('hungry, with nothing it eats in the stores, it goes on counting', near(c.unfed ?? 0, 0.5), `${c.unfed}`);
crate.items.push({ uid: g.inventory.nextUid++, id: 'wheat', ql: 30, dmg: 0, count: 2 });
c.hunger = 0.1;
c.searchAt = 0;
c.unfed = 5000;
call('updateWorker', c, 0.25, g);
check('with something it eats there, it eats and the count starts again', (c.unfed ?? 0) < 1 && c.hunger > 0.5, `${c.unfed} ${c.hunger}`);
c.unfed = UPKEEP_FOR - 1;
const fed = g.creatures.taskMul(c, 'reed');
c.unfed = UPKEEP_FOR;
const unfed = g.creatures.taskMul(c, 'reed');
check(`a second short of the day it works at its full pace, and at the day at ${UNFED_PACE} of it`,
  near(fed, g.creatures.workMul(c)) && near(unfed, fed * UNFED_PACE) && !unfedNow({ unfed: UPKEEP_FOR - 1 }) && unfedNow({ unfed: UPKEEP_FOR }), `${fed} ${unfed}`);
{
  c.state = 'idle';
  call('beginForage', g, c, 'reed');
  const secs = c.until - g.time;
  check(`so a go at its task takes it ${1 / UNFED_PACE} times as long, unfed`, near(secs, workDuration(c.skills[GATHER_SKILL.reed]) / fed / UNFED_PACE), `${secs}`);
}

/* ---- the words ---------------------------------------------------------------------------------------------------- */

check('a fed worker\'s card says nothing of it', unfedSays({ species: 'sedra', unfed: UPKEEP_FOR - 1 }) === '');
{
  const says = unfedSays({ species: 'sedra', unfed: UPKEEP_FOR + 1800 });
  check('an unfed one\'s card says how long, what it does to its pace, off the rule, and that there is no food it eats in your stores',
    says.startsWith(`Unfed for ${timeWords(UPKEEP_FOR + 1800)}: work pace ${percent(UNFED_PACE)} until fed.`) && says.includes('No food it eats in your settlement stores'), says);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na day without a meal slows a worker — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
