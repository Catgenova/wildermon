/**
 * An ancient brace, a work post's worker fed from its stores, and seed one harvest in a few.
 *
 * Asked for: "Also add an Ancient Brace that increases wildermon action speed by 1% per, up to 50 uses per wildermon, 5
 * parts. Implement that wildermon on a workpost will feed themselves eligible food from containers in work range when
 * hungry, as they would on a deed. Reduce standard seed yield when farming to 30% chance of getting 1 per harvest".
 * This asks, of both sides:
 *
 *   * that an old brace of five pieces restores into an ancient brace, which puts `BRACE_STEP` on a wildermon's action
 *     speed a use, up to `BRACE_MOST`, and is refused and kept after that, in the same words;
 *   * that a hungry worker on a post eats from a container its keeper made within the post's range, and not from one
 *     somebody else made, nor one out of range;
 *   * that a harvest gives one seed about `SEED_CHANCE` of the time, and a tend says so the same way.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { RELICS } from '../../src/game/archaeology';
import { CREATURE_ACTION_BY_ID } from '../../src/game/creatureActions';
import { bloodMul, BRACE_MOST, BRACE_STEP } from '../../src/game/creatures';
import { ITEM_DEFS } from '../../src/game/items';
import { cropYield, harvestSeeds, SEED_CHANCE, seedSays } from '../../src/game/farming';

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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
/** Harvests the seed odds are sampled over, and how far from the expected count they may land. */
const HARVESTS = 4000;
const inBand = (n: number): boolean => Math.abs(n - HARVESTS * SEED_CHANCE) < 4 * Math.sqrt(HARVESTS * SEED_CHANCE * (1 - SEED_CHANCE));
const U = '62626262-6262-4262-8262-626262626262';
const V = '63636363-6363-4363-8363-636363636363';

/* ---- on the island ----------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v uuid := '${V}'; a int; c creature; px double precision; py double precision; i int;
        v_work double precision; v_post bigint; v_mine int; v_theirs int; v_far int; v_n int := 0; v_ate text;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Brace and seed', 627, 60, 16, 16, true) returning id into w;
  perform land_blank(w, 60);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 59) x, generate_series(0, 59) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Bracer');
  select x, y into px, py from player where world_id = w and uid = u;
  insert into said select 'RELIC', name || ':' || parts || ':' || difficulty || ':' || result from relic_def where result = 'ancient_brace';
  insert into said values ('NUMBERS', brace_step() || '|' || brace_most() || '|' || seed_chance() || '|' || seed_says());

  -- The brace, to the most it takes and once more.
  a := creature_spawn(w, 'rabba', px + 0.5, py, 'active', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, name = 'Ash', kept = null, boosts = null, care = 0 where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  v_work := beast_mul(c, 'work');
  perform give(w, u, 'ancient_brace', ${BRACE_MOST + 1}, 30);
  for i in 1 .. ${BRACE_MOST + 1} loop
    if creature_refusal(w, u, 'use_ancient_brace', jsonb_build_object('kind', 'creature', 'id', a)) is null then
      perform perform_creature(w, u, 'use_ancient_brace', jsonb_build_object('kind', 'creature', 'id', a));
    end if;
  end loop;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('BRACED', brace_points(c) || '|' || (beast_mul(c, 'work') / v_work) || '|' || pack_count(w, u, 'ancient_brace')
    || '|' || coalesce(creature_refusal(w, u, 'use_ancient_brace', jsonb_build_object('kind', 'creature', 'id', a)), '-'));
  insert into said select 'BRACETOLD', text from event where world_id = w and uid = u and text like 'Ancient brace used on%' order by n limit 1;

  -- A post's worker, hungry, with a crate of its keeper's in range, one of somebody else's, and one out of range.
  insert into placed (world_id, kind, x, y, cx, cy, ql, made_by)
    values (w, 'post', floor(px)::int + 2, floor(py)::int, floor(px) + 2.375, py, 90, u) returning id into v_post;
  update creature set mode = 'deed', post = v_post, hunger = 0.1 where world_id = w and id = a;
  select coalesce(max(id), 0) + 1 into v_theirs from crate where world_id = w;
  insert into crate (world_id, id, kind, x, y, made_by) values (w, v_theirs, 'plank', floor(px)::int + 3, floor(py)::int, v);
  insert into item (world_id, holder, crate, def, ql, count)
    select w, 'crate', v_theirs, sd.item, 10, 3 from species_diet sd where sd.species = 'rabba' limit 1;
  v_far := v_theirs + 1;
  insert into crate (world_id, id, kind, x, y, made_by) values (w, v_far, 'plank', floor(px)::int + 40, floor(py)::int, u);
  insert into item (world_id, holder, crate, def, ql, count)
    select w, 'crate', v_far, sd.item, 10, 3 from species_diet sd where sd.species = 'rabba' limit 1;
  insert into said values ('NOTMINE', coalesce(worker_feed(w, a), 'nothing'));
  v_mine := v_far + 1;
  insert into crate (world_id, id, kind, x, y, made_by) values (w, v_mine, 'plank', floor(px)::int + 2, floor(py)::int + 1, u);
  insert into item (world_id, holder, crate, def, ql, count)
    select w, 'crate', v_mine, sd.item, 20, 3 from species_diet sd where sd.species = 'rabba' limit 1;
  v_ate := worker_feed(w, a);
  select * into c from creature where world_id = w and id = a;
  insert into said values ('MINE', coalesce(v_ate, 'nothing') || '|' || (c.hunger > 0.1)::text || '|'
    || (select sum(count) from item where world_id = w and holder = 'crate' and crate = v_mine) || '|'
    || (select sum(count) from item where world_id = w and holder = 'crate' and crate = v_theirs) || '|'
    || (select sum(count) from item where world_id = w and holder = 'crate' and crate = v_far));

  -- And one on a settlement, with no post: as ever, the settlement's containers (this was an error once, every round).
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Bracehold', floor(px)::int + 40, floor(py)::int, 5, 1, u);
  update creature set post = null, hunger = 0.1, from_x = floor(px) + 40.5, from_y = py, to_x = floor(px) + 40.5, to_y = py,
      leg_at = now(), leg_ends = now()
    where world_id = w and id = a;
  v_ate := worker_feed(w, a);
  insert into said values ('DEED', coalesce(v_ate, 'nothing') || '|'
    || (select sum(count) from item where world_id = w and holder = 'crate' and crate = v_far));

  -- Seed: one, about seed_chance() of the time.
  for i in 1 .. ${HARVESTS} loop v_n := v_n + harvest_seeds(); end loop;
  insert into said values ('SEEDS', v_n || '|' || array_to_string(crop_yield(0), ',') || '|' || array_to_string(crop_yield(3), ','));
  insert into said values ('TENDSAYS', (pg_get_functiondef('perform_farm'::regproc) like '%seed_says()%')::text || '|'
    || (pg_get_functiondef('perform_planter'::regproc) like '%seed_says()%')::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(627);
g.time = 3600 * 24 * 60;
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
const ash = g.creatures.spawn('rabba', g.player.x + 1, g.player.y, 'active', g.rand, g.time - 3600 * 24 * 30);
ash.traits = [];
ash.rare = 0;
ash.name = 'Ash';
ash.boosts = undefined;
const T = { kind: 'creature' as const, id: ash.id };
const brace = CREATURE_ACTION_BY_ID.get('use_ancient_brace')!;
const told = (start: string): string[] => g.log.map((e) => e.text).filter((t) => t.startsWith(start));

/* ---- both ---------------------------------------------------------------------------- */

const relic = RELICS.find((r) => r.result === 'ancient_brace');
check('an old brace of five pieces restores into an ancient brace, the same on both sides',
  !!relic && relic.parts === 5 && at('RELIC') === `${relic.name}:${relic.parts}:${relic.difficulty}:${relic.result}`
    && !!ITEM_DEFS.ancient_brace && !ITEM_DEFS.ancient_brace.description?.includes('{'), at('RELIC'));
check('the numbers are the same on both sides',
  at('NUMBERS') === `${BRACE_STEP}|${BRACE_MOST}|${SEED_CHANCE}|${seedSays()}`, `${at('NUMBERS')} | ${seedSays()}`);

{
  const work = bloodMul(ash, 'work');
  for (let i = 0; i < BRACE_MOST + 1; i++) g.inventory.add('ancient_brace', { ql: 30 });
  for (let i = 0; i < BRACE_MOST + 1; i++) if (!brace.check?.(T, g)) brace.perform(T, g);
  const [n, mul, left, why] = at('BRACED').split('|');
  check(`${BRACE_MOST} uses, action speed +${BRACE_STEP * BRACE_MOST * 100}%, one brace kept, on both sides`,
    Number(n) === BRACE_MOST && near(Number(mul), 1 + BRACE_STEP * BRACE_MOST) && left === '1'
      && near(bloodMul(ash, 'work') / work, 1 + BRACE_STEP * BRACE_MOST) && g.inventory.countAll('ancient_brace') === 1, at('BRACED'));
  check('one more is refused in the same words on both sides', brace.check?.(T, g) === why && why === `Ash: ${BRACE_MOST} ancient brace uses, the max.`, why);
  check('both sides say the same when it is used', told('Ancient brace used on')[0] === at('BRACETOLD'), `${told('Ancient brace used on')[0]} | ${at('BRACETOLD')}`);
}

check('on a post, nothing from a container somebody else made, nor one out of its range', at('NOTMINE') === 'nothing', at('NOTMINE'));
{
  const [ate, fed, mine, theirs, far] = at('MINE').split('|');
  check('on a post, hungry, it eats from a container its keeper made in range: one off it, and fed',
    ate !== 'nothing' && fed === 'true' && mine === '2' && theirs === '3' && far === '3', at('MINE'));
}

check('on a settlement with no post, it eats from the settlement\'s containers, as ever', /^[a-z_]+\|2$/.test(at('DEED')) && !at('DEED').startsWith('nothing'), at('DEED'));
{
  const [n, untended, tended] = at('SEEDS').split('|');
  let browser = 0;
  for (let i = 0; i < HARVESTS; i++) browser += harvestSeeds(g.rand);
  check(`a harvest gives one seed about ${SEED_CHANCE * 100}% of the time, on both sides`,
    inBand(Number(n)) && inBand(browser), `island ${n}, browser ${browser} of ${HARVESTS}`);
  check('one seed however it was tended, and the produce as before, on both sides',
    untended === `${cropYield(0).seeds},${cropYield(0).produce}` && tended === `${cropYield(3).seeds},${cropYield(3).produce}` && cropYield(3).seeds === 1,
    `${untended} ${tended}`);
  check('a tend says it the same way on both sides', at('TENDSAYS') === 'true|true', at('TENDSAYS'));
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a brace, a post worker's meal and scarcer seed — ${ok.length} of ${ok.length}`);
