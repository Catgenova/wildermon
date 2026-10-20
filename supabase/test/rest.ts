/**
 * Deed workers tire, rest, and sleep in a bed of their own size.
 *
 * Asked for: "Rest and stamina. Workers tire after N goes and rest for a short while. A bed or pen on the deed shortens
 * the rest", and of the wildermon beds, "wildermon can only use [the bed] equivalent to their evolution stage". This
 * asks, of both sides:
 *
 *   * that the numbers are the same (`TIRE_GOES`, `REST_FOR`, `BED_REST`, `DEN_HEALTH`), and every kind's bed class at
 *     the levels that matter (`denClass`, the island's `den_class`): its stage for a kind that evolves, its health band
 *     for one that does not;
 *   * that a worker goes `TIRE_GOES` goes and no more before it rests, rests `REST_FOR` where it stands with no bed, and
 *     gets up with its stamina full; and that the rest is no go in its ledger;
 *   * that with a free bed of its class on the settlement it walks to it, lies in it (`sleeper`) for `BED_REST` of the
 *     rest, and lets it go when it gets up; and that a bed of another class is no bed to it, for a kind that evolves at
 *     its second stage and for a kind that does not by its health;
 *   * that a second worker finding the bed taken when it gets there rests where it stands;
 *   * that the bed is let go when its sleeper is called to heel, crated or killed, or the bed is moved;
 *   * and that its card says it: stamina, and "Asleep in a small wildermon bed: N more seconds."
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import {
  BED_REST, DEN_HEALTH, denClass, EVOLVE_AT, REST_FOR, restFor, SPECIES, staminaOf, staminaSays, TIRE_GOES, type Creature,
} from '../../src/game/creatures';
import { furnitureCentre, type PlacedFurniture } from '../../src/game/furniture';
import { idleSays } from '../../src/game/workerlog';
import { ITEM_DEFS } from '../../src/game/items';
import { share, spanWords } from '../../src/game/words';
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
const near = (a: number, b: number, by = 1e-6): boolean => Math.abs(a - b) <= by;
const [AT1, AT2] = EVOLVE_AT;
const T = 16;
const U = '7e5b0000-0000-4000-8000-0000000000e3';
// Every kind at a level of each stage, for its bed class on both sides.
const KINDS = Object.values(SPECIES).filter((d) => !d.monster).map((d) => d.id);
const LEVELS = [10, AT1, AT2];

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; a int; b int; c creature; r jsonb; v_small bigint; v_medium bigint; v_other bigint; i int;
        v_goes int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Rest', 177, 40, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, seen_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Reststead', ${T}, ${T}, 10, 5, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 1, 'plank', ${T + 1}, ${T}, 0, 0, true, u);
  insert into said values ('NUMS', tire_goes() || ',' || rest_for() || ',' || bed_rest() || ',' || den_health_1() || ',' || den_health_2());

  -- Every kind's bed class at a level of each stage.
  ${KINDS.map((sp) => `
  a := creature_spawn(w, '${sp}', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  ${LEVELS.map((lv) => `
  update creature set skills = (select jsonb_object_agg(k, ${lv}) from jsonb_object_keys(coalesce(nullif(skills, '{}'::jsonb), '{"foraging": 1}'::jsonb)) k) where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('CLASS_${sp}_${lv}', den_class(c)::text || ',' || (select jsonb_object_agg(k, v) from jsonb_each(c.skills) e(k, v))::text);`).join('')}
  delete from creature where world_id = w and id = a;`).join('')}

  -- A mender at the crate, its goes at the island's own pace: no more than TIRE_GOES before it rests.
  insert into item (world_id, holder, crate, gx, gy, def, ql, dmg, count)
    select w, 'crate', 1, ${T + 1}, ${T}, 'hatchet', 90, 99, 1 from generate_series(1, 6);
  a := creature_spawn(w, 'tinka', ${T + 1} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null, worn = 0,
         skills = jsonb_build_object('repair', 10), work_x = ${T + 1}, work_y = ${T},
         from_x = ${T + 1} + 0.5, from_y = ${T} + 0.5, to_x = ${T + 1} + 0.5, to_y = ${T} + 0.5
   where world_id = w and id = a;
  for i in 1 .. ${TIRE_GOES} loop
    update creature set phase = 'work', until = now() - interval '0.3 seconds', leg_at = now() - interval '1 second',
           leg_ends = now() - interval '1 second' where world_id = w and id = a;
    perform worker_settle(w, a);
    if i = ${TIRE_GOES - 1} then
      insert into said select 'WORN29', worn || ',' || phase from creature where world_id = w and id = a;
    end if;
  end loop;
  select (ledger->'now'->>'goes')::int into v_goes from creature where world_id = w and id = a;
  insert into said select 'WORN30', worn || ',' || phase || ',' || v_goes from creature where world_id = w and id = a;
  -- Idle now, and nothing left: it rests where it stands, there being no bed.
  update creature set until = now() - interval '0.3 seconds' where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'RESTING', phase || ',' || extract(epoch from until - leg_at) || ',' || coalesce(bed::text, '-') || ',' || coalesce(idle_why, '-')
    from creature where world_id = w and id = a;
  r := rpc_creatures(w, 40);
  insert into said select 'SENTREST', coalesce(e->>'idleWhy', '') || '|' || round((e->>'idleN')::numeric) || '|' || coalesce(e->>'worn', '')
    from jsonb_array_elements(r) e where (e->>'id')::int = a;
  -- And up: its stamina full, no go counted for the rest, and off to work again.
  update creature set until = now() - interval '0.3 seconds', leg_at = now() - interval '0.3 seconds', leg_ends = now() - interval '0.3 seconds'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'UP', worn || ',' || phase || ',' || (ledger->'now'->>'goes') || ',' || coalesce(idle_why, '-') from creature where world_id = w and id = a;
  delete from creature where world_id = w and id = a;
  delete from item where world_id = w and holder = 'crate';

  -- Two beds, a small and a medium, on the settlement; and a small one off it.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'den_small', ${T - 4}, ${T}, 0, 0, ${T - 4} + 0.5, ${T} + 0.5, 40, u) returning id into v_small;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'den_medium', ${T + 4}, ${T}, 0, 0, ${T + 4} + 0.5, ${T} + 0.5, 40, u) returning id into v_medium;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'den_small', ${T + 15}, ${T}, 0, 0, ${T + 15} + 0.5, ${T} + 0.5, 40, u) returning id into v_other;

  -- A tired Reedpup at its first stage, idle and empty-handed: to the small bed, into it, and up out of it.
  a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null, worn = ${TIRE_GOES},
         skills = jsonb_build_object('foraging', 10), phase = 'idle',
         from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5,
         until = now() - interval '0.3 seconds', leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'TOBED', phase || ',' || (bed = v_small)::text || ',' || to_x || ',' || to_y || ',' || coalesce(idle_why, '-')
    from creature where world_id = w and id = a;
  r := rpc_creatures(w, 40);
  insert into said select 'SENTTIRED', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->>'idleBed', '') from jsonb_array_elements(r) e where (e->>'id')::int = a;
  -- There.
  update creature set until = now() - interval '0.3 seconds' where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'INBED', cr.phase || ',' || extract(epoch from cr.until - cr.leg_at) || ',' || coalesce(p.sleeper = a, false)::text
    from creature cr, placed p where cr.world_id = w and cr.id = a and p.id = v_small;
  -- Somebody's card.
  update player set seen_at = now() where world_id = w and uid = u;
  r := rpc_creatures(w, 40);
  insert into said select 'SENTBED', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->>'idleBed', '') || '|' || round((e->>'idleN')::numeric)
    from jsonb_array_elements(r) e where (e->>'id')::int = a;
  -- A second tired one of its class: the one bed of its size is taken, so it rests where it stands.
  b := creature_spawn(w, 'sedra', ${T - 2} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null, worn = ${TIRE_GOES},
         skills = jsonb_build_object('foraging', 12), phase = 'idle',
         from_x = ${T - 2} + 0.5, from_y = ${T} + 0.5, to_x = ${T - 2} + 0.5, to_y = ${T} + 0.5,
         until = now() - interval '0.3 seconds', leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = b;
  perform worker_settle(w, b);
  insert into said select 'SECOND', phase || ',' || coalesce(bed::text, '-') || ',' || extract(epoch from until - leg_at) from creature where world_id = w and id = b;
  -- And one that set out for it while it was free, and finds it taken when it gets there: it looks again, and rests.
  update creature set phase = 'bed', bed = v_small, until = now() - interval '0.3 seconds' where world_id = w and id = b;
  perform worker_settle(w, b);
  insert into said select 'TAKEN', phase || ',' || coalesce(bed::text, '-') || ',' || extract(epoch from until - leg_at) from creature where world_id = w and id = b;
  delete from creature where world_id = w and id = b;
  -- Up out of the bed, which is free again.
  update creature set until = now() - interval '0.3 seconds', leg_at = now() - interval '0.3 seconds', leg_ends = now() - interval '0.3 seconds'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'OUTOFBED', cr.worn || ',' || coalesce(cr.bed::text, '-') || ',' || coalesce(p.sleeper::text, '-')
    from creature cr, placed p where cr.world_id = w and cr.id = a and p.id = v_small;

  -- Into it again, and let go of the bed each way it stops being a worker: to heel, crated, killed; and the bed moved.
  ${['heel', 'crate', 'kill', 'move'].map((how) => `
  update placed set sleeper = null, x = ${T - 4}, cx = ${T - 4} + 0.5 where id = v_small;
  if not exists (select 1 from creature where world_id = w and id = a) then
    a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  end if;
  update creature set mode = 'deed', traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null,
         worn = ${TIRE_GOES}, skills = jsonb_build_object('foraging', 10), phase = 'bed', bed = v_small,
         from_x = ${T - 4} + 0.5, from_y = ${T} + 0.5, to_x = ${T - 4} + 0.5, to_y = ${T} + 0.5,
         until = now() - interval '0.3 seconds', leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'LAY_${how}', coalesce(sleeper::text, '-') from placed where id = v_small;
  ${how === 'heel' ? `update creature set mode = 'active' where world_id = w and id = a;`
    : how === 'crate' ? `perform crate_shut_in(w, a, 0, null);`
    : how === 'kill' ? `delete from creature where world_id = w and id = a;`
    : `update placed set x = ${T - 5}, cx = ${T - 5} + 0.5 where id = v_small;`}
  insert into said select 'FREED_${how}', coalesce(p.sleeper::text, '-') || ',' || coalesce((select coalesce(cr.bed::text, '-') || ',' || cr.phase from creature cr where cr.world_id = w and cr.id = a), 'gone')
    from placed p where p.id = v_small;`).join('')}

  -- At its second stage the small bed is not its size and the medium one is: it walks to the medium.
  if not exists (select 1 from creature where world_id = w and id = a) then
    a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  end if;
  update placed set sleeper = null where world_id = w;
  update creature set mode = 'deed', traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null, bed = null,
         worn = ${TIRE_GOES}, skills = jsonb_build_object('foraging', ${AT1 + 2}), phase = 'idle',
         from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5,
         until = now() - interval '0.3 seconds', leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'STAGE1', phase || ',' || coalesce((bed = v_medium)::text, '-') from creature where world_id = w and id = a;
  -- And at its third, neither: it rests where it stands.
  update creature set bed = null, worn = ${TIRE_GOES}, skills = jsonb_build_object('foraging', ${AT2 + 2}), phase = 'idle',
         until = now() - interval '0.3 seconds' where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'STAGE2', phase || ',' || coalesce(bed::text, '-') || ',' || extract(epoch from until - leg_at) from creature where world_id = w and id = a;
  delete from creature where world_id = w and id = a;

  -- A kind that does not evolve sleeps by its health: a Bogga in the medium bed, a Magga in the small one.
  ${[['bogga', 'MEDIUM'], ['magga', 'SMALL']].map(([sp, k]) => `
  a := creature_spawn(w, '${sp}', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null, worn = ${TIRE_GOES},
         phase = 'idle', from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5,
         until = now() - interval '0.3 seconds', leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'KIND_${sp}', phase || ',' || coalesce((select p.sub from placed p where p.id = cr.bed), '-') from creature cr where world_id = w and id = a;
  delete from creature where world_id = w and id = a;`).join('')}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the rule, on both sides -------------------------------------------------------------------------------------- */

check(`the numbers are the same on both sides: ${TIRE_GOES} goes, ${REST_FOR} seconds, ${BED_REST} of it in a bed, health bands ${DEN_HEALTH.join(' and ')}`,
  at('NUMS') === [TIRE_GOES, REST_FOR, BED_REST, DEN_HEALTH[0], DEN_HEALTH[1]].join(','), at('NUMS'));
{
  const wrong: string[] = [];
  for (const sp of KINDS) {
    for (const lv of LEVELS) {
      const [cls, skills] = at(`CLASS_${sp}_${lv}`).split(/,(.*)/s);
      const mine = denClass({ species: sp, skills: JSON.parse(skills ?? '{}') });
      if (String(mine) !== cls) wrong.push(`${sp}@${lv}: island ${cls}, browser ${mine}`);
    }
  }
  check(`every kind's bed class is the same on both sides at level 10, ${AT1} and ${AT2} (${KINDS.length} kinds)`, wrong.length === 0, wrong.slice(0, 6).join('; '));
}
check('a kind that evolves sleeps in the bed of its stage: small, medium, large',
  LEVELS.every((lv, i) => denClass({ species: 'sedra', skills: { foraging: lv } }) === i));
check(`a kind that does not evolve sleeps by its health: under ${DEN_HEALTH[0]} small, under ${DEN_HEALTH[1]} medium, else large`,
  denClass({ species: 'magga', skills: {} }) === 0 && denClass({ species: 'bogga', skills: {} }) === 1 && denClass({ species: 'testa', skills: {} }) === 2
  && SPECIES.magga.health < DEN_HEALTH[0] && SPECIES.bogga.health >= DEN_HEALTH[0] && SPECIES.bogga.health < DEN_HEALTH[1] && SPECIES.testa.health >= DEN_HEALTH[1]);

/* ---- on the island ----------------------------------------------------------------------------------------------- */

check(`on the island, a worker still working after ${TIRE_GOES - 1} goes`, at('WORN29') === `${TIRE_GOES - 1},idle`, at('WORN29'));
check(`and after its ${TIRE_GOES}th it is worn out, its goes counted to its ledger`, at('WORN30') === `${TIRE_GOES},idle,${TIRE_GOES}`, at('WORN30'));
{
  const [phase, secs, bed, why] = at('RESTING').split(',');
  check(`with no bed on the settlement of its size it rests where it stands, ${REST_FOR} seconds`, phase === 'rest' && near(Number(secs), REST_FOR) && bed === '-' && why === 'rest', at('RESTING'));
}
{
  const [why, n, worn] = at('SENTREST').split('|');
  check('and its card is told it rests, the seconds left, and its stamina spent', why === 'rest' && Math.abs(Number(n) - REST_FOR) <= 2 && worn === String(TIRE_GOES), at('SENTREST'));
}
check('it gets up with its stamina full and goes back to work, and the rest was no go in its ledger',
  at('UP').split(',')[0] === '0' && at('UP').split(',')[1] !== 'rest' && at('UP').split(',')[2] === String(TIRE_GOES), at('UP'));
{
  const [phase, mine, x] = at('TOBED').split(',');
  check('with a free bed of its size it walks to the nearest one on the settlement, not one off it', phase === 'bed' && mine === 'true' && Number(x) === T - 4 + 0.5, at('TOBED'));
  check('and its card says it is going to rest in it', at('SENTTIRED') === 'tired|den_small', at('SENTTIRED'));
}
{
  const [phase, secs, lying] = at('INBED').split(',');
  check(`there it lies in it, named its sleeper, for ${BED_REST} of the rest: ${restFor(true)} seconds`, phase === 'rest' && near(Number(secs), restFor(true)) && lying === 'true', at('INBED'));
  const [why, bed, n] = at('SENTBED').split('|');
  check('and its card says it is asleep in it, with the seconds left', why === 'bed' && bed === 'den_small' && Math.abs(Number(n) - restFor(true)) <= 2, at('SENTBED'));
}
check('a second tired one of its size, the one bed of its size taken, rests where it stands', at('SECOND') === `rest,-,${REST_FOR}.000000`, at('SECOND'));
{
  const [phase, bed, secs] = at('TAKEN').split(',');
  check('and finding it taken when it gets there, rests where it stands', phase === 'rest' && bed === '-' && near(Number(secs), REST_FOR), at('TAKEN'));
}
check('up out of the bed: its stamina full and the bed free', at('OUTOFBED') === '0,-,-', at('OUTOFBED'));
for (const [how, what] of [['heel', 'called to heel'], ['crate', 'shut in a crate'], ['kill', 'killed'], ['move', 'the bed moved']]) {
  check(`lying in the bed, and the bed let go when ${what}`, at(`LAY_${how}`) !== '-' && at(`FREED_${how}`).startsWith('-,'), `${at(`LAY_${how}`)} / ${at(`FREED_${how}`)}`);
}
check('and one called to heel or crated has no bed and no rest left', ['heel', 'crate'].every((h) => /^-,-,(idle|.*)$/.test(at(`FREED_${h}`)) && !at(`FREED_${h}`).endsWith(',rest')),
  `${at('FREED_heel')} / ${at('FREED_crate')}`);
check('at its second stage the small bed is not its size and the medium one is', at('STAGE1') === 'bed,true', at('STAGE1'));
{
  const [phase, bed, secs] = at('STAGE2').split(',');
  check('at its third, with no large bed, it rests where it stands', phase === 'rest' && bed === '-' && near(Number(secs), REST_FOR), at('STAGE2'));
}
check('a kind that does not evolve goes to the bed of its health: a Bogga to the medium, a Magga to the small',
  at('KIND_bogga') === 'bed,den_medium' && at('KIND_magga') === 'bed,den_small', `${at('KIND_bogga')} / ${at('KIND_magga')}`);

/* ---- in the browser ---------------------------------------------------------------------------------------------- */

const g = Game.create(4256);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = T - 12; y <= T + 12; y++) for (let x = T - 12; x <= T + 18; x++) { g.world.setHeight(x, y, 4); g.world.setDirt(x, y, 5); g.world.setTile(x, y, TileType.Grass, 0); }
g.player.x = T + 0.5;
g.player.y = T + 0.5;
g.deed = { name: 'Reststead', x: T, y: T, radius: 10, level: 5, mine: true };
g.crates.clear();
for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
const crate = g.addCrate('plank', T + 1, T, 0, 0, [], true);
g.rand = () => 0.5;
const cr = g.creatures as unknown as Record<string, (...a: unknown[]) => unknown>;
const call = (name: string, ...a: unknown[]): unknown => cr[name].call(g.creatures, ...a);
const yes = (): boolean => true;
const step = (c: Creature): void => void call('updateWorker', c, 0.05, g);
const worker = (sp: string, skills: Record<string, number>, x = T + 0.5, y = T + 0.5): Creature => {
  const c = g.creatures.spawn(sp, x, y, 'deed', g.rand, g.time - 3600 * 24 * 30);
  c.traits = [];
  c.rare = 0;
  c.care = 0;
  c.hunger = 1;
  c.stance = 'passive';
  c.skills = skills;
  c.until = g.time - 1;
  return c;
};

// A mender at the crate, a go after another.
{
  crate.items.splice(0, crate.items.length, ...Array.from({ length: 6 }, () => ({ uid: g.inventory.nextUid++, id: 'hatchet', ql: 90, dmg: 99, count: 1 })));
  const c = worker('tinka', { repair: 10 }, T + 1.5, T + 0.5);
  for (let i = 0; i < TIRE_GOES - 1; i++) call('mendStep', g, c, yes);
  const card = staminaSays(c);
  check(`in the browser, a worker after ${TIRE_GOES - 1} goes has one left, its card saying so`, c.worn === TIRE_GOES - 1 && card.includes(`1 of ${TIRE_GOES} goes left`), `${c.worn} "${card}"`);
  call('mendStep', g, c, yes);
  const goes = c.ledger?.now.goes;
  c.busyUntil = 0;
  c.until = g.time - 1;
  step(c);
  check(`after its ${TIRE_GOES}th it rests where it stands, there being no bed, ${REST_FOR} seconds`,
    c.state === 'rest' && c.worn === TIRE_GOES && near((c.restUntil ?? 0) - g.time, REST_FOR) && staminaOf(c) === 0, `${c.state} ${c.worn} ${(c.restUntil ?? 0) - g.time}`);
  check('and its card says so', idleSays(c.idle!, 'mend') === `Resting: ${REST_FOR} more seconds.`, c.idle ? idleSays(c.idle, 'mend') : 'no idle');
  g.time += REST_FOR - 1;
  step(c);
  check('still resting a second before its rest is out', c.state === 'rest', c.state);
  g.time += 1;
  // Nothing left to mend, so that what it does when it is up is no go either.
  crate.items.splice(0);
  step(c);
  check('and up with its stamina full when it is, the rest no go in its ledger', c.state !== 'rest' && (c.worn ?? 0) === 0 && c.ledger?.now.goes === goes, `${c.state} ${c.worn} ${c.ledger?.now.goes}/${goes}`);
  g.creatures.remove(c.id);
  crate.items.splice(0);
}

// Beds.
const small = g.addFurniture('den_small', T - 4, T, 0, 0, 40);
const medium = g.addFurniture('den_medium', T + 4, T, 0, 0, 40);
g.addFurniture('den_small', T + 15, T, 0, 0, 40);
const tired = (sp: string, skills: Record<string, number>, x = T + 0.5): Creature => {
  const c = worker(sp, skills, x);
  c.worn = TIRE_GOES;
  return c;
};
const walkTo = (c: Creature, f: PlacedFurniture): void => {
  [c.x, c.y] = furnitureCentre(f);
  step(c);
};
{
  const c = tired('sedra', { foraging: 10 });
  step(c);
  check('in the browser, with a free bed of its size it walks to the nearest one on the settlement',
    c.state === 'toBed' && c.bed === small.id && c.idle?.why === 'tired', `${c.state} ${c.bed}/${small.id}`);
  check('and its card says so', idleSays(c.idle!, 'reed') === 'Tired: walking to a small wildermon bed to rest in it.', idleSays(c.idle!, 'reed'));
  walkTo(c, small);
  check(`there it lies in it, its sleeper, for ${BED_REST} of the rest: ${restFor(true)} seconds`,
    c.state === 'rest' && small.sleeper === c.id && near((c.restUntil ?? 0) - g.time, restFor(true)), `${c.state} ${small.sleeper} ${(c.restUntil ?? 0) - g.time}`);
  step(c);
  check('and its card says it is asleep in it', c.idle?.why === 'bed' && idleSays(c.idle, 'reed').startsWith('Asleep in a small wildermon bed: '), c.idle ? idleSays(c.idle, 'reed') : 'no idle');
  // A second of its size, tired: the bed is taken, so it rests where it stands.
  const d = tired('sedra', { foraging: 12 }, T - 2.5);
  step(d);
  check('a second tired one of its size, with the one bed taken, rests where it stands', d.state === 'rest' && d.bed === undefined && near((d.restUntil ?? 0) - g.time, REST_FOR), `${d.state} ${d.bed}`);
  g.creatures.remove(d.id);
  g.time += restFor(true);
  step(c);
  check('up out of the bed when its rest is out: its stamina full and the bed free', c.state !== 'rest' && (c.worn ?? 0) === 0 && small.sleeper === undefined && c.bed === undefined,
    `${c.state} ${c.worn} ${small.sleeper}`);
  // And let go of each way it stops lying there.
  const lay = (): void => {
    c.mode = 'deed';
    c.worn = TIRE_GOES;
    c.state = 'idle';
    c.until = g.time - 1;
    c.calledAt = -1e9;
    step(c);
    walkTo(c, small);
  };
  lay();
  const lying = small.sleeper === c.id;
  c.mode = 'active';
  g.creatures.update(0.05, g);
  check('lying in the bed, and the bed let go when called to heel', lying && small.sleeper === undefined && c.bed === undefined && c.restUntil === undefined, `${lying} ${small.sleeper}`);
  lay();
  c.mode = 'stored';
  g.creatures.update(0.05, g);
  check('and when shut in a crate', small.sleeper === undefined && c.bed === undefined, `${small.sleeper}`);
  lay();
  c.calledAt = g.time;
  step(c);
  check('and when called over', small.sleeper === undefined && c.bed === undefined, `${small.sleeper}`);
  lay();
  g.creatures.kill(g, c, null, true);
  check('and when killed', small.sleeper === undefined, `${small.sleeper}`);
}
{
  const c = tired('sedra', { foraging: AT1 + 2 });
  step(c);
  check('in the browser, at its second stage the small bed is not its size and the medium one is', c.state === 'toBed' && c.bed === medium.id, `${c.state} ${c.bed}`);
  c.state = 'idle';
  c.bed = undefined;
  c.skills = { foraging: AT2 + 2 };
  step(c);
  check('and at its third, with no large bed, it rests where it stands', c.state === 'rest' && c.bed === undefined, `${c.state} ${c.bed}`);
  g.creatures.remove(c.id);
}
for (const [sp, f] of [['bogga', medium], ['magga', small]] as const) {
  const c = tired(sp, {});
  step(c);
  check(`in the browser, a ${SPECIES[sp].name}, which does not evolve, goes to the ${f.kind === 'den_small' ? 'small' : 'medium'} bed by its health`, c.state === 'toBed' && c.bed === f.id, `${c.state} ${c.bed}`);
  g.creatures.remove(c.id);
}
// A water carrier between its fill and its pour rests with the bucket in its arms, as an errand does on the island.
{
  const c = tired('holla', { carrying: 10 });
  c.carrying = { uid: g.inventory.nextUid++, id: 'water_bucket', ql: 40, dmg: 0, count: 1 };
  for (const f of [...g.furniture.values()]) if (f.kind.startsWith('den_')) g.removeFurniture(f.id);
  step(c);
  check('between the steps of an errand it rests whatever it holds', c.state === 'rest' && c.carrying?.id === 'water_bucket', `${c.state}`);
  g.creatures.remove(c.id);
}

/* ---- the words ---------------------------------------------------------------------------------------------------- */

for (const [id, stage] of [['den_small', 'first'], ['den_medium', 'second'], ['den_large', 'third']] as const) {
  const words = ITEM_DEFS[id].description ?? '';
  check(`the ${ITEM_DEFS[id].name.toLowerCase()}'s words say whom it fits and what it does, off the rule`,
    !words.includes('{') && words.includes(`its ${stage} stage`) && words.includes(`for ${share(BED_REST)} as long: ${spanWords(restFor(true))} where it would rest ${spanWords(REST_FOR)}`)
    && words.includes(`every ${TIRE_GOES} goes`) && words.includes(`${id === 'den_large' ? DEN_HEALTH[1] : DEN_HEALTH[0]} health`), words);
}
check('a stamina line says the goes left and both rests, off the rule',
  staminaSays({ worn: 10 }) === `Stamina: ${TIRE_GOES - 10} of ${TIRE_GOES} goes left before it rests ${spanWords(REST_FOR)}, or ${spanWords(restFor(true))} in a bed of its size on the settlement.`,
  staminaSays({ worn: 10 }));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nworkers tire, rest, and sleep in a bed of their size — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

