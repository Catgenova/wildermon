/**
 * Each stage lets a deed worker do more at once.
 *
 * Asked for: "Each stage unlocks something, not just bigger numbers": a trade that carries a load between where it
 * gets it and where it goes carries its stage's loads a trip, and a trade worked in place on things in your stores
 * handles its stage's number a go, by one rule, `STAGE_LOADS` (the island's `stage_loads`), and "one go = one gain".
 * This asks, of both sides:
 *
 *   * that the rule is the same: the loads at each stage, for kinds that evolve and one that does not, and which
 *     trades carry and which handle (`LOAD_TRADES`, `HANDS_TRADES`, the island's `load_trade` and `hands_trade`);
 *   * that a water carrier at its second stage fills two buckets and pours twice the litres in one go, and at its
 *     first one, with what one go teaches either way;
 *   * that a mender at its second stage mends the two most damaged things in the stores in a go, and at its third the
 *     three, leaving the rest, and a brick-maker at its second makes two batches, with what one go teaches;
 *   * that a reed cutter at its second stage walks on from the first load to the next tile rather than home, goes home
 *     with the second, and puts both away; at its first it goes home with one; and each cut teaches what a cut does.
 *
 * The kinds that carry water and make bricks do not evolve yet, so they are given stages here, as a kind that does
 * would have, to hold them to the rule.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import {
  GATHER_SKILL, HANDS_TRADES, learnPace, LOAD_TRADES, SPECIES, STAGE_LOADS, stageLoads, stageWorkSays, EVOLVE_AT,
  type Creature, type GatherKind,
} from '../../src/game/creatures';
import { BUCKET_LITRES } from '../../src/game/furniture';
import { skillGain } from '../../src/game/skills';
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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
const [AT1, AT2] = EVOLVE_AT;
const KINDS = Object.keys(GATHER_SKILL) as GatherKind[];
// The kinds given stages for the test, as one that evolves has them.
const STAGED = ['holla', 'mudda'];

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const LEVELS: Array<[string, string, number]> = [
  ['sedra', 'foraging', 10], ['sedra', 'foraging', AT1], ['sedra', 'foraging', AT2], ['tinka', 'repair', AT2],
  ['cobbe', 'masonry', AT1], ['embra', 'smelting', AT1 - 0.5], ['magga', 'foraging', 90], ['woola', 'animal_husbandry', AT2],
];
const T = 16;
const U = '7e5b0000-0000-4000-8000-0000000000e2';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; a int; c creature; i int; v double precision; r double precision; x0 double precision;
        v_well bigint; v_barrel bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stagework', 177, 40, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Stagework', ${T}, ${T}, 10, 1, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 1, 'plank', ${T + 1}, ${T}, 0, 0, true, u);
  update species_def set stages = array['Rillpup', 'Rillhound'] where id = 'holla';
  update species_def set stages = array['Wheelmote', 'Rollterra'] where id = 'mudda';

  -- The rule, at each level asked about, and which trades it carries for and which it handles for.
  ${LEVELS.map(([sp, skill, lv], n) => `
  a := creature_spawn(w, '${sp}', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  -- No blood: a deep-pocketed one carries a load more (\`trait_add\`).
  update creature set skills = jsonb_build_object('${skill}', ${lv}), traits = '{}' where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('LOADS${n}', stage_loads(c)::text);
  delete from creature where world_id = w and id = a;`).join('')}
  insert into said select 'CARRY', string_agg(k, ',' order by k) from unnest(array[${KINDS.map((k) => `'${k}'`).join(', ')}]) k where load_trade(k);
  insert into said select 'HANDS', string_agg(k, ',' order by k) from unnest(array[${KINDS.map((k) => `'${k}'`).join(', ')}]) k where hands_trade(k);
  insert into said values ('AT', stage_loads_at(0) || ',' || stage_loads_at(1) || ',' || stage_loads_at(2));

  -- A water carrier at each of its first two stages: filled at the well and poured into an empty barrel.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, litres, since)
    values (w, 'furniture', 'well', ${T + 3}, ${T + 3}, 0, 0, ${T + 4}, ${T + 4}, 40, u, 100, now()) returning id into v_well;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, litres)
    values (w, 'furniture', 'barrel', ${T - 3}, ${T}, 0, 0, ${T - 3} + 0.5, ${T} + 0.5, 40, u, 0) returning id into v_barrel;
  for i in 0..1 loop
    a := creature_spawn(w, 'holla', ${T + 3} + 0.5, ${T + 3} + 0.5, 'deed', now() - interval '30 days', u);
    update creature set traits = '{}', rare = null, care = 0, carrying = null, work_x = ${T + 3}, work_y = ${T + 3},
           skills = jsonb_build_object('carrying', case i when 0 then 10 else ${AT1} end)
     where world_id = w and id = a;
    insert into said select 'WELLWAS' || i, round(placed_litres(p))::text from placed p where p.id = v_well;
    perform errand_do(w, a);
    insert into said select 'FILLED' || i, coalesce(carrying->>'def', '-') || ',' || coalesce(carrying->>'count', '-') from creature where world_id = w and id = a;
    insert into said select 'WELL' || i, round(placed_litres(p))::text from placed p where p.id = v_well;
    update placed set litres = 0, liquid = null where id = v_barrel;
    update creature set work_x = ${T - 3}, work_y = ${T}, to_x = ${T - 3} + 0.5, to_y = ${T} + 0.5 where world_id = w and id = a;
    select * into c from creature where world_id = w and id = a;
    v := (c.skills->>'carrying')::double precision;
    perform setseed(0.3); r := random();
    x0 := skill_gain_of(v, 0.2 * beast_mul(c, 'learn') * learn_pace(c, 'carrying'), 0.6 + 0.8 * r);
    perform setseed(0.3);
    perform errand_do(w, a);
    insert into said select 'POURED' || i, round(p.litres)::text || ',' || coalesce(cr.carrying::text, '-') || ',' || ((cr.skills->>'carrying')::double precision - v) || ',' || x0
      from placed p, creature cr where p.id = v_barrel and cr.world_id = w and cr.id = a;
    update placed set litres = 100, since = now() where id = v_well;
    delete from creature where world_id = w and id = a;
  end loop;

  -- A mender at its second and third stages, at a crate with three damaged things in it.
  for i in 1..2 loop
    delete from item where world_id = w and holder = 'crate';
    insert into item (world_id, holder, crate, gx, gy, def, ql, dmg, count) values
      (w, 'crate', 1, ${T + 1}, ${T}, 'hatchet', 50, 50, 1), (w, 'crate', 1, ${T + 1}, ${T}, 'saw', 50, 40, 1),
      (w, 'crate', 1, ${T + 1}, ${T}, 'carving_knife', 50, 30, 1);
    a := creature_spawn(w, 'tinka', ${T + 1} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
    update creature set traits = '{}', rare = null, care = 0, work_x = ${T + 1}, work_y = ${T},
           skills = jsonb_build_object('repair', case i when 1 then ${AT1} else ${AT2} end)
     where world_id = w and id = a;
    select * into c from creature where world_id = w and id = a;
    v := (c.skills->>'repair')::double precision;
    perform setseed(0.4); r := random();
    x0 := skill_gain_of(v, 0.2 * beast_mul(c, 'learn') * learn_pace(c, 'repair'), 0.6 + 0.8 * r);
    perform setseed(0.4);
    perform errand_go(w, a);
    insert into said select 'MENDED' || i, string_agg(def || ':' || dmg, ',' order by def) from item where world_id = w and holder = 'crate';
    insert into said select 'MENDGAIN' || i, ((cr.skills->>'repair')::double precision - v) || ',' || x0 from creature cr where cr.world_id = w and cr.id = a;
    delete from creature where world_id = w and id = a;
  end loop;

  -- A brick-maker at its second stage, with five clay in the crate.
  delete from item where world_id = w and holder = 'crate';
  insert into item (world_id, holder, crate, gx, gy, def, ql, count) values (w, 'crate', 1, ${T + 1}, ${T}, 'clay', 40, 5);
  a := creature_spawn(w, 'mudda', ${T + 1} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, work_x = ${T + 1}, work_y = ${T},
         skills = jsonb_build_object('pottery', ${AT1}) where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  v := (c.skills->>'pottery')::double precision;
  -- What it makes is rolled first (worker_made_ql), and then what it learns.
  perform setseed(0.5); r := random(); r := random();
  x0 := skill_gain_of(v, 0.25 * beast_mul(c, 'learn') * learn_pace(c, 'pottery'), 0.6 + 0.8 * r);
  perform setseed(0.5);
  perform errand_go(w, a);
  insert into said select 'BRICKS', string_agg(def || ':' || count, ',' order by def) from item where world_id = w and holder = 'crate';
  insert into said select 'BRICKGAIN', ((cr.skills->>'pottery')::double precision - v) || ',' || x0 from creature cr where cr.world_id = w and cr.id = a;
  delete from creature where world_id = w and id = a;
  delete from item where world_id = w and holder = 'crate';

  -- A reed cutter at each of its first two stages: a cut, and then what it does next.
  perform land_set_tile(w, x, ${T + 4}, tile_id('Reed')) from generate_series(${T - 2}, ${T + 2}) x;
  for i in 0..1 loop
    a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T + 3} + 0.5, 'deed', now() - interval '30 days', u);
    update creature set traits = '{}', rare = null, care = 0, carrying = null, hunger = 1, stance = 'passive',
           skills = jsonb_build_object('foraging', case i when 0 then 10 else ${AT1} end),
           phase = 'work', work_x = ${T}, work_y = ${T + 4}, from_x = ${T} + 0.5, from_y = ${T + 3} + 0.5,
           to_x = ${T} + 0.5, to_y = ${T + 3} + 0.5, until = now() - interval '0.3 seconds', leg_at = now(), leg_ends = now()
     where world_id = w and id = a;
    select * into c from creature where world_id = w and id = a;
    v := (c.skills->>'foraging')::double precision;
    perform setseed(0.6); r := random();
    x0 := skill_gain_of(v, 0.225 * beast_mul(c, 'learn') * learn_pace(c, 'foraging'), 0.6 + 0.8 * r);
    perform setseed(0.6);
    perform worker_settle(w, a);
    insert into said select 'CUT1_' || i, cr.phase || ',' || loads_in(cr.carrying) || ',' || ((cr.skills->>'foraging')::double precision - v) || ',' || x0
      from creature cr where cr.world_id = w and cr.id = a;
    -- And the next cut, from where it stands.
    update creature set phase = 'work', work_x = ${T + 1}, work_y = ${T + 4}, until = now() - interval '0.3 seconds'
     where world_id = w and id = a and phase <> 'home';
    perform worker_settle(w, a);
    insert into said select 'CUT2_' || i, cr.phase || ',' || loads_in(cr.carrying) from creature cr where cr.world_id = w and cr.id = a;
    -- Home at the crate: every load put away.
    update creature set phase = 'home', from_x = ${T + 1} + 0.5, from_y = ${T} + 0.5, to_x = ${T + 1} + 0.5, to_y = ${T} + 0.5,
           until = now() - interval '0.3 seconds'
     where world_id = w and id = a;
    perform worker_settle(w, a);
    insert into said select 'HOME_' || i, coalesce((select sum(count) from item where world_id = w and holder = 'crate' and def = 'reed'), 0)
      || ',' || loads_in(cr.carrying) from creature cr where cr.world_id = w and cr.id = a;
    delete from item where world_id = w and holder = 'crate';
    delete from creature where world_id = w and id = a;
  end loop;

  -- Shut in a crate with two loads in its arms: both go down.
  a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set carrying = load_join(jsonb_build_object('def', 'reed', 'count', 1, 'ql', 30), jsonb_build_object('def', 'reed', 'count', 2, 'ql', 30))
   where world_id = w and id = a;
  perform crate_shut_in(w, a, 0, null);
  insert into said select 'DROPPED', coalesce(sum(count), 0)::text from item where world_id = w and holder = 'ground' and def = 'reed';
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the rule, on both sides ------------------------------------------------------------------------------------- */

for (const sp of STAGED) SPECIES[sp].stages = [{ name: 'One', description: '' }, { name: 'Two', description: '' }];
check(`the loads at each stage are ${STAGE_LOADS.join(', ')} on both sides`, at('AT') === STAGE_LOADS.join(','), at('AT'));
LEVELS.forEach(([sp, skill, lv], n) => {
  const mine = stageLoads({ species: sp, skills: { [skill]: lv } });
  check(`a ${SPECIES[sp].name} at ${lv} takes ${mine} at once on both sides`, at(`LOADS${n}`) === String(mine), `island ${at(`LOADS${n}`)}`);
});
check('the trades that carry their stage\'s loads are the same on both sides',
  at('CARRY') === KINDS.filter((k) => LOAD_TRADES.has(k)).sort().join(','), at('CARRY'));
check('the trades that handle their stage\'s number a go are the same on both sides',
  at('HANDS') === KINDS.filter((k) => HANDS_TRADES.has(k)).sort().join(','), at('HANDS'));
check('no trade both carries and handles',
  KINDS.every((k) => !(LOAD_TRADES.has(k) && HANDS_TRADES.has(k))));

/* ---- on the island ----------------------------------------------------------------------------------------------- */

for (const i of [0, 1]) {
  const n = STAGE_LOADS[i];
  const [poured, carrying, gain, one] = at(`POURED${i}`).split(',');
  check(`on the island, a water carrier at its ${i ? 'second' : 'first'} stage fills ${n} at the well and pours ${n * BUCKET_LITRES} litres in one go`,
    at(`FILLED${i}`) === `water_bucket,${n}` && Number(at(`WELLWAS${i}`)) - Number(at(`WELL${i}`)) === n * BUCKET_LITRES && poured === String(n * BUCKET_LITRES) && carrying === '-',
    `${at(`FILLED${i}`)} well ${at(`WELLWAS${i}`)} to ${at(`WELL${i}`)}, barrel ${poured}, left ${carrying}`);
  check(`and the pour teaches what one go does`, near(Number(gain), Number(one)), `${gain} against ${one}`);
}
for (const i of [1, 2]) {
  const n = STAGE_LOADS[i];
  const want = ['carving_knife', 'hatchet', 'saw'].map((def) => {
    const dmg = { hatchet: 50, saw: 40, carving_knife: 30 }[def]!;
    const mended = [50, 40, 30].slice(0, n).includes(dmg);
    return { def, mended, dmg };
  });
  const got = new Map(at(`MENDED${i}`).split(',').map((s) => s.split(':') as [string, string]));
  check(`on the island, a mender at its ${i === 1 ? 'second' : 'third'} stage mends the ${n} most damaged in one go and leaves the rest`,
    want.every((x) => (Number(got.get(x.def)) < x.dmg) === x.mended), at(`MENDED${i}`));
  const [gain, one] = at(`MENDGAIN${i}`).split(',').map(Number);
  check('and the go teaches what one go does', near(gain, one), `${gain} against ${one}`);
}
check(`on the island, a brick-maker at its second stage makes ${STAGE_LOADS[1]} batches in one go`,
  at('BRICKS') === `clay:${5 - STAGE_LOADS[1]},unfired_clay_brick:${STAGE_LOADS[1]}`, at('BRICKS'));
{
  const [gain, one] = at('BRICKGAIN').split(',').map(Number);
  check('and the go teaches what one go does', near(gain, one), `${gain} against ${one}`);
}
{
  const [phase0, loads0, gain0, one0] = at('CUT1_0').split(',');
  const [phase1, loads1, gain1, one1] = at('CUT1_1').split(',');
  check('on the island, a reed cutter at its first stage goes home with its one load',
    phase0 === 'home' && loads0 === '1' && at('HOME_0') === '1,0', `${at('CUT1_0')} / home ${at('HOME_0')}`);
  check(`at its second it walks on from the first rather than home, goes home with the ${STAGE_LOADS[1]}nd, and puts both away`,
    phase1 !== 'home' && loads1 === '1' && at('CUT2_1') === `home,${STAGE_LOADS[1]}` && at('HOME_1') === `${STAGE_LOADS[1]},0`,
    `${at('CUT1_1')} / ${at('CUT2_1')} / home ${at('HOME_1')}`);
  check('and each cut teaches what one cut does, at either stage', near(Number(gain0), Number(one0)) && near(Number(gain1), Number(one1)),
    `${gain0}/${one0} ${gain1}/${one1}`);
}
check('shut in a crate with two loads in its arms, both go down where it stood', at('DROPPED') === '3', at('DROPPED'));

/* ---- in the browser ---------------------------------------------------------------------------------------------- */

const g = Game.create(4255);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = T - 8; y <= T + 8; y++) for (let x = T - 8; x <= T + 8; x++) { g.world.setHeight(x, y, 4); g.world.setDirt(x, y, 5); g.world.setTile(x, y, TileType.Grass, 0); }
g.player.x = T + 0.5;
g.player.y = T + 0.5;
g.deed = { name: 'Stagework', x: T, y: T, radius: 10, level: 1, mine: true };
g.crates.clear();
const crate = g.addCrate('plank', T + 1, T, 0, 0, [], true);
// What the crate holds, changed in place: the stores the workers look in are the crates themselves, listed once a tick.
const stock = (items: Array<{ id: string; dmg?: number; count?: number }>): void => {
  crate.items.splice(0, crate.items.length, ...items.map(({ id, dmg = 0, count = 1 }) => ({ uid: g.inventory.nextUid++, id, ql: 50, dmg, count })));
};
g.rand = () => 0.5;
const ROLL = 0.6 + 0.8 * 0.5;
const cr = g.creatures as unknown as Record<string, (...a: unknown[]) => unknown>;
const call = (name: string, ...a: unknown[]): unknown => cr[name].call(g.creatures, ...a);
const yes = (): boolean => true;
const worker = (sp: string, skill: string, lv: number, x = T + 0.5, y = T + 0.5): Creature => {
  const c = g.creatures.spawn(sp, x, y, 'deed', g.rand, g.time - 3600 * 24 * 30);
  c.traits = [];
  c.rare = 0;
  c.care = 0;
  c.hunger = 1;
  c.stance = 'passive';
  c.skills = { [skill]: lv };
  return c;
};
const oneGain = (c: Creature, skill: string, base: number): number => skillGain(c.skills[skill], base * g.creatures.learnMul(c, g.time) * learnPace(c, skill), ROLL);

// Water: a well and an empty barrel.
const well = g.addFurniture('well', T + 3, T + 3, 0, 0, 40);
well.litres = 100;
const barrel = g.addFurniture('barrel', T - 3, T, 0, 0, 40);
for (const i of [0, 1]) {
  const n = STAGE_LOADS[i];
  barrel.litres = 0;
  delete barrel.liquid;
  well.litres = 100;
  const c = worker('holla', 'carrying', i ? AT1 : 10, T + 3.5, T + 3.5);
  call('waterStep', g, c, 0.05, 20, yes, yes);
  const filled = `${c.carrying?.id},${c.carrying?.count}`;
  const one = oneGain(c, 'carrying', 0.2);
  const was = c.skills.carrying;
  call('waterStep', g, c, 0.05, 20, yes, yes);
  check(`in the browser, a water carrier at its ${i ? 'second' : 'first'} stage fills ${n} at the well and pours ${n * BUCKET_LITRES} litres in one go`,
    filled === `water_bucket,${n}` && well.litres === 100 - n * BUCKET_LITRES && barrel.litres === n * BUCKET_LITRES && !c.carrying,
    `${filled} well ${well.litres} barrel ${barrel.litres}`);
  check('and the pour teaches what one go does', near(c.skills.carrying - was, one), `${c.skills.carrying - was} against ${one}`);
  g.creatures.remove(c.id);
}

// Mending, at the second and third stages.
for (const i of [1, 2]) {
  const n = STAGE_LOADS[i];
  stock([{ id: 'hatchet', dmg: 50 }, { id: 'saw', dmg: 40 }, { id: 'carving_knife', dmg: 30 }]);
  const c = worker('tinka', 'repair', i === 1 ? AT1 : AT2, T + 1.5, T + 0.5);
  const one = oneGain(c, 'repair', 0.2);
  const was = c.skills.repair;
  call('mendStep', g, c, yes);
  const mended = crate.items.filter((it) => it.dmg < { hatchet: 50, saw: 40, carving_knife: 30 }[it.id as 'saw']!).map((it) => it.id).sort().join(',');
  check(`in the browser, a mender at its ${i === 1 ? 'second' : 'third'} stage mends the ${n} most damaged in one go and leaves the rest`,
    mended === ['hatchet', 'saw', 'carving_knife'].slice(0, n).sort().join(','), mended);
  check('and the go teaches what one go does', near(c.skills.repair - was, one), `${c.skills.repair - was} against ${one}`);
  g.creatures.remove(c.id);
}

// Bricks, at the second stage.
{
  stock([{ id: 'clay', count: 5 }]);
  const c = worker('mudda', 'pottery', AT1, T + 1.5, T + 0.5);
  const one = oneGain(c, 'pottery', 0.25);
  const was = c.skills.pottery;
  call('recipeStep', g, c, ['make_clay_brick'], yes);
  const said = crate.items.map((it) => `${it.id}:${it.count}`).sort().join(',');
  check(`in the browser, a brick-maker at its second stage makes ${STAGE_LOADS[1]} batches in one go`,
    said === `clay:${5 - STAGE_LOADS[1]},unfired_clay_brick:${STAGE_LOADS[1]}`, said);
  check('and the go teaches what one go does', near(c.skills.pottery - was, one), `${c.skills.pottery - was} against ${one}`);
  g.creatures.remove(c.id);
  stock([]);
}

// Reeds: a cut, then what it does next, at each of the first two stages.
for (let x = T - 2; x <= T + 2; x++) g.world.setTile(x, T + 4, TileType.Reed, 0);
for (const i of [0, 1]) {
  const c = worker('sedra', 'foraging', i ? AT1 : 10, T + 0.5, T + 3.5);
  const cut = (x: number): void => {
    c.state = 'forage';
    c.until = g.time - 0.1;
    c.workX = x;
    c.workY = T + 4;
    call('updateWorker', c, 0.05, g);
  };
  const one = oneGain(c, 'foraging', 0.225);
  const was = c.skills.foraging;
  cut(T);
  const gain = c.skills.foraging - was;
  call('updateWorker', c, 0.05, g);
  const first = `${c.homeward ? 'home' : 'on'},${(c.carrying ? 1 : 0) + (c.laden?.length ?? 0)}`;
  if (!c.homeward) {
    cut(T + 1);
    call('updateWorker', c, 0.05, g);
  }
  const second = `${c.homeward ? 'home' : 'on'},${(c.carrying ? 1 : 0) + (c.laden?.length ?? 0)}`;
  // At the crate: every load put away.
  c.x = crate.x + 0.5;
  c.y = crate.y + 0.5;
  for (let k = 0; k < 6 && c.carrying; k++) call('updateWorker', c, 0.05, g);
  const home = crate.items.filter((it) => it.id === 'reed').reduce((n, it) => n + it.count, 0);
  if (i === 0) {
    check('in the browser, a reed cutter at its first stage goes home with its one load and puts it away',
      first === 'home,1' && home === 1 && !c.carrying, `${first} / ${home}`);
  } else {
    check(`at its second it walks on from the first rather than home, goes home with the ${STAGE_LOADS[1]}nd, and puts both away`,
      first === 'on,1' && second === `home,${STAGE_LOADS[1]}` && home === STAGE_LOADS[1] && !c.carrying && !c.laden?.length,
      `${first} / ${second} / ${home}`);
  }
  check('and the cut teaches what one cut does', near(gain, one), `${gain} against ${one}`);
  stock([]);
  g.creatures.remove(c.id);
}

/* ---- the words ---------------------------------------------------------------------------------------------------- */

for (const sp of ['sedra', 'tinka', 'cobbe', 'embra', 'quarra']) {
  const d = SPECIES[sp];
  // Its third stage's, with its line's own third-stage loads where it has them (`STAGE_PERKS`).
  const n = stageLoads({ species: sp, skills: { [GATHER_SKILL[d.gathers!]]: AT2 } });
  const work = stageWorkSays(d.gathers, n)!;
  check(`a ${d.stages![1].name}'s words say what its stage lets it do at once, with the number off the rule`,
    !!work && d.stages![1].description.includes(`It ${work[0]} ${work[1]}`) && work[1].includes(String(n)), d.stages![1].description);
}
check('and a kind with no trade, or one a stage lets do no more at once, is told nothing of it',
  ['woola', 'warda', 'whispet', 'roxxen', 'orse'].every((sp) => !SPECIES[sp].stages![1].description.includes(' a trip') && !SPECIES[sp].stages![1].description.includes(' a cycle,')));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\neach stage does more at once — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
