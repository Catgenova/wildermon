/**
 * A settlement's worker keeps to its own settlement: its beds, its work, its stores and what lies on it.
 *
 * Reported: "wildermon beds will attract wildermon from across the map, breaking them and making them walk across
 * oceans to go sleep and then they cant return. They should only attract wildermon working on the settlement to which
 * the beds belong". And: "wildermon are still leaving settlement to go work on other settlements or steal their
 * materials". So this asks, of Annholm (Ann's, radius 5 round 30,30), Bostead (Bo's, round 60,30, Ann a citizen of it)
 * and Carholm (Cara's, round 30,60) on an island of their own:
 *
 *   * a tired Annholm worker on its ground walks to a free bed of its size on Annholm, and lies in it;
 *   * with the only free bed on Bostead it rests where it stands (`free_bed`; the browser's `freeBed`);
 *   * a tired worker on a post, and one off its ground, rest where they stand, a free bed on Annholm or not;
 *   * one on a post that set out for an Annholm bed does not lie in it when it gets there;
 *   * a worker's own settlement is Annholm alone (`on_home_deed`), not Bostead, as `on_my_deed` has it for Ann;
 *   * it picks up nothing lying on Bostead, fells no tree on Bostead or Carholm, plants on neither, and does all of it
 *     on Annholm and off every settlement (`worker_gatherable`, `planting_spot`; the browser's `gatherable`,
 *     `plantingSpot`);
 *   * it fills no store on Bostead, Ann's own crate there included, and does on Annholm and off every settlement
 *     (`private.worker_may`);
 *   * and the stranded ones are put back (`private.workers_put_home`): one on a post standing on Annholm, at its post;
 *     one in an Annholm bed from a post, at its post with the bed let go; one far off, by Annholm's token; one at work
 *     on its ground left where it is; and a second time, nobody.
 *
 * Makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { TIRE_GOES, type Creature } from '../../src/game/creatures';
import { TileType } from '../../src/world/tiles';
import { psql, ok, bad, check } from './harness';

const ANN = '0e5b0000-0000-4000-8000-0000000000a1';
const BO = '0e5b0000-0000-4000-8000-0000000000b0';
const CARA = '0e5b0000-0000-4000-8000-0000000000c0';
/** Annholm's token, Bostead's and Carholm's; radius 5 each. A post off every settlement, and a spot far off. */
const A = [30, 30], B = [60, 30], C = [30, 60], POST = [30, 100], FAR = [90, 110];

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; a int; c creature; v_home bigint; v_theirs bigint; v_post bigint; v_far int; v_put int; v_bed int; v_at int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Own ground', 191, 128, ${A[0]}, ${A[1]}, true) returning id into w;
  perform land_blank(w, 128);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 127) x, generate_series(0, 127) y;
  perform set_config('request.jwt.claims', json_build_object('sub', '${BO}')::text, true);
  perform rpc_join(w, 'Bo');
  perform set_config('request.jwt.claims', json_build_object('sub', '${CARA}')::text, true);
  perform rpc_join(w, 'Cara');
  perform set_config('request.jwt.claims', json_build_object('sub', '${ANN}')::text, true);
  perform rpc_join(w, 'Ann');
  update player set body_at = now(), x = ${A[0]} + 0.5, y = ${A[1]} + 0.5, seen_at = now() where world_id = w;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Annholm', ${A[0]}, ${A[1]}, 5, 5, '${ANN}');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Bostead', ${B[0]}, ${B[1]}, 5, 5, '${BO}');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Carholm', ${C[0]}, ${C[1]}, 5, 5, '${CARA}');
  insert into deed_member (world_id, founder, uid, role) values (w, '${BO}', '${ANN}', 'guest');
  insert into said select 'MINE_BO', on_my_deed(w, '${ANN}', ${B[0]}, ${B[1]})::text;
  insert into said select 'HOME_BO', on_home_deed(w, '${ANN}', ${B[0]}, ${B[1]})::text || ',' || on_home_deed(w, '${ANN}', ${A[0]}, ${A[1]})::text;

  -- Beds: a small one on Bostead, free.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'den_small', ${B[0]}, ${B[1]}, 0, 0, ${B[0]} + 0.5, ${B[1]} + 0.5, 40, '${BO}') returning id into v_theirs;
  -- A tired Annholm Reedpup at its first stage, on Annholm.
  a := creature_spawn(w, 'sedra', ${A[0]} + 0.5, ${A[1]} + 0.5, 'deed', now() - interval '60 days', '${ANN}');
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null, worn = ${TIRE_GOES},
         skills = jsonb_build_object('foraging', 10), phase = 'idle',
         until = now() - interval '0.3 seconds', leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('RANGE', work_range(c)::text);
  perform worker_settle(w, a);
  insert into said select 'CITIZEN_BED', phase || ',' || coalesce(bed::text, '-') from creature where world_id = w and id = a;

  -- And a small one on Annholm: to it, and into it.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'den_small', ${A[0] - 3}, ${A[1]}, 0, 0, ${A[0] - 3} + 0.5, ${A[1]} + 0.5, 40, '${ANN}') returning id into v_home;
  update creature set phase = 'idle', bed = null, worn = ${TIRE_GOES}, from_x = ${A[0]} + 0.5, from_y = ${A[1]} + 0.5,
         to_x = ${A[0]} + 0.5, to_y = ${A[1]} + 0.5, until = now() - interval '0.3 seconds',
         leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'HOME_BED', phase || ',' || coalesce((bed = v_home)::text, '-') from creature where world_id = w and id = a;
  update creature set until = now() - interval '0.3 seconds' where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'IN_HOME_BED', cr.phase || ',' || coalesce((p.sleeper = a)::text, 'false')
    from creature cr, placed p where cr.world_id = w and cr.id = a and p.id = v_home;
  update placed set sleeper = null where id = v_home;
  delete from creature where world_id = w and id = a;

  -- On a post off every settlement, tired, the Annholm bed free.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'post', 'post', ${POST[0]}, ${POST[1]}, 0, 0, ${POST[0]} + 0.5, ${POST[1]} + 0.5, 50, '${ANN}') returning id into v_post;
  a := creature_spawn(w, 'sedra', ${POST[0]} + 0.5, ${POST[1]} + 1.5, 'deed', now() - interval '60 days', '${ANN}');
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null, worn = ${TIRE_GOES},
         skills = jsonb_build_object('foraging', 10), phase = 'idle', post = v_post,
         until = now() - interval '0.3 seconds', leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'POST_BED', phase || ',' || coalesce(bed::text, '-') from creature where world_id = w and id = a;
  -- And one that set out for it before: does not lie in it.
  update creature set phase = 'bed', bed = v_home, worn = ${TIRE_GOES}, from_x = ${A[0] - 3} + 0.5, from_y = ${A[1]} + 0.5,
         to_x = ${A[0] - 3} + 0.5, to_y = ${A[1]} + 0.5, until = now() - interval '0.3 seconds',
         leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'POST_ARRIVED', cr.phase || ',' || coalesce(cr.bed::text, '-') || ',' || coalesce(p.sleeper::text, '-')
    from creature cr, placed p where cr.world_id = w and cr.id = a and p.id = v_home;
  delete from creature where world_id = w and id = a;

  -- An Annholm worker far off its ground, tired.
  a := creature_spawn(w, 'sedra', ${FAR[0]} + 0.5, ${FAR[1]} + 0.5, 'deed', now() - interval '60 days', '${ANN}');
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null, worn = ${TIRE_GOES},
         skills = jsonb_build_object('foraging', 10), phase = 'idle',
         until = now() - interval '0.3 seconds', leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second'
   where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'FAR_BED', phase || ',' || coalesce(bed::text, '-') from creature where world_id = w and id = a;
  delete from creature where world_id = w and id = a;

  -- Its work, a far-reaching one's: Bostead (Ann a citizen) and Carholm (a stranger's) within its range.
  a := creature_spawn(w, 'sedra', ${A[0]} + 0.5, ${A[1]} + 0.5, 'deed', now() - interval '60 days', '${ANN}');
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', skills = jsonb_build_object('foraging', 90)
   where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('FAR_RANGE', work_range(c)::text);
  insert into item (world_id, holder, gx, gy, def, ql, count) values (w, 'ground', ${B[0] + 1}, ${B[1]}, 'plank', 30, 3);
  insert into item (world_id, holder, gx, gy, def, ql, count) values (w, 'ground', ${A[0] + 1}, ${A[1] + 1}, 'plank', 30, 3);
  insert into said select 'FETCH', worker_gatherable(w, ${B[0] + 1}, ${B[1]}, 'fetch', c)::text || ',' || worker_gatherable(w, ${A[0] + 1}, ${A[1] + 1}, 'fetch', c)::text;
  perform land_set_tile(w, ${B[0] + 2}, ${B[1] + 2}, tile_id('Tree'));
  perform land_set_tile(w, ${C[0] + 2}, ${C[1] + 2}, tile_id('Tree'));
  perform land_set_tile(w, ${A[0] + 2}, ${A[1] + 2}, tile_id('Tree'));
  perform land_set_tile(w, 45, 45, tile_id('Tree'));
  insert into said select 'FELL', worker_gatherable(w, ${B[0] + 2}, ${B[1] + 2}, 'woodcut', c)::text || ',' || worker_gatherable(w, ${C[0] + 2}, ${C[1] + 2}, 'woodcut', c)::text
    || ',' || worker_gatherable(w, ${A[0] + 2}, ${A[1] + 2}, 'woodcut', c)::text || ',' || worker_gatherable(w, 45, 45, 'woodcut', c)::text;
  insert into said select 'PLANT', coalesce((select s.x || ',' || s.y from planting_spot(w, ${B[0]}, ${B[1]}, 3, '${ANN}') s), '-')
    || '|' || coalesce((select s.x || ',' || s.y from planting_spot(w, ${C[0]}, ${C[1]}, 3, '${ANN}') s), '-')
    || '|' || coalesce((select 'some' from planting_spot(w, 45, 45, 3, '${ANN}') s), '-');
  insert into said select 'FILL', private.worker_may(w, '${ANN}', '${ANN}', null, ${B[0] + 1}, ${B[1]})::text
    || ',' || private.worker_may(w, '${ANN}', '${ANN}', null, ${A[0] + 1}, ${A[1]})::text
    || ',' || private.worker_may(w, '${ANN}', '${ANN}', null, 45, 45)::text;
  delete from creature where world_id = w and id = a;

  -- Stranded: one on the post standing on Annholm; one from the post asleep in the Annholm bed; one far off, idle; and
  -- one at work on its ground.
  a := creature_spawn(w, 'sedra', ${A[0]} + 0.5, ${A[1]} + 2.5, 'deed', now() - interval '60 days', '${ANN}');
  update creature set phase = 'idle', post = v_post, idle_why = 'far' where world_id = w and id = a;
  v_put := a;
  a := creature_spawn(w, 'sedra', ${A[0] - 3} + 0.5, ${A[1]} + 0.5, 'deed', now() - interval '60 days', '${ANN}');
  update creature set phase = 'rest', post = v_post, bed = v_home, until = now() + interval '1 hour' where world_id = w and id = a;
  update placed set sleeper = a where id = v_home;
  v_bed := a;
  v_far := creature_spawn(w, 'sedra', ${FAR[0]} + 0.5, ${FAR[1]} + 0.5, 'deed', now() - interval '60 days', '${ANN}');
  update creature set phase = 'idle', idle_why = 'far' where world_id = w and id = v_far;
  v_at := creature_spawn(w, 'sedra', ${A[0] + 1} + 0.5, ${A[1]} + 0.5, 'deed', now() - interval '60 days', '${ANN}');
  update creature set phase = 'idle' where world_id = w and id = v_at;
  insert into said values ('PUT_N', private.workers_put_home(w)::text);
  insert into said select 'PUT_POST', round(creature_x(cr)::numeric, 2) || ',' || round(creature_y(cr)::numeric, 2) || ',' || phase || ',' || coalesce(idle_why, '-')
    from creature cr where world_id = w and id = v_put;
  insert into said select 'PUT_BED', round(creature_x(cr)::numeric, 2) || ',' || round(creature_y(cr)::numeric, 2) || ',' || phase || ',' || coalesce(cr.bed::text, '-')
    || ',' || coalesce((select sleeper::text from placed where id = v_home), '-')
    from creature cr where world_id = w and id = v_bed;
  insert into said select 'PUT_FAR', round(creature_x(cr)::numeric, 2) || ',' || round(creature_y(cr)::numeric, 2) || ',' || phase
    from creature cr where world_id = w and id = v_far;
  insert into said select 'PUT_AT', round(creature_x(cr)::numeric, 2) || ',' || round(creature_y(cr)::numeric, 2)
    from creature cr where world_id = w and id = v_at;
  insert into said values ('PUT_AGAIN', private.workers_put_home(w)::text);
end $t$;
select k || '=' || v from said;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const f2 = (n: number): string => n.toFixed(2);

check('island: Bostead is Ann\'s by `on_my_deed` (a citizen), and her workers\' settlement is Annholm alone (`on_home_deed`)',
  at('MINE_BO') === 'true' && at('HOME_BO') === 'false,true', `${at('MINE_BO')} ${at('HOME_BO')}`);
check('island: a tired Annholm worker, the only free bed on Bostead: rests where it stands', at('CITIZEN_BED') === 'rest,-', at('CITIZEN_BED'));
check('island: with a free bed on Annholm, it walks to it and lies in it', at('HOME_BED') === 'bed,true' && at('IN_HOME_BED') === 'rest,true',
  `${at('HOME_BED')} ${at('IN_HOME_BED')}`);
check('island: a tired worker on a post off every settlement, the Annholm bed free: rests where it stands', at('POST_BED') === 'rest,-', at('POST_BED'));
check('island: one on a post that set out for the Annholm bed does not lie in it', /^rest,-,-$/.test(at('POST_ARRIVED')), at('POST_ARRIVED'));
check(`island: a tired Annholm worker ${FAR[0] - A[0]} tiles off its ground (range ${at('RANGE')}): rests where it stands`,
  at('FAR_BED') === 'rest,-', at('FAR_BED'));
check(`island: what lies on Bostead is not fetched, what lies on Annholm is (range ${at('FAR_RANGE')})`,
  Number(at('FAR_RANGE')) > B[0] - A[0] + 5 && at('FETCH') === 'false,true', at('FETCH'));
check('island: no tree felled on Bostead or Carholm; on Annholm and off every settlement, yes', at('FELL') === 'false,false,true,true', at('FELL'));
check('island: nothing planted on Bostead or Carholm; off every settlement, yes', at('PLANT') === '-|-|some', at('PLANT'));
check('island: no store filled on Bostead, Ann\'s own crate there included; on Annholm and off every settlement, yes',
  at('FILL') === 'false,true,true', at('FILL'));
check('island: three stranded workers put back, the one at work on its ground left', at('PUT_N') === '3', at('PUT_N'));
check('island: the post\'s worker standing on Annholm, at its post, idle',
  at('PUT_POST') === `${f2(POST[0] + 0.5)},${f2(POST[1] + 1.1)},idle,-`, at('PUT_POST'));
check('island: the post\'s worker asleep in the Annholm bed, at its post, the bed let go',
  at('PUT_BED') === `${f2(POST[0] + 0.5)},${f2(POST[1] + 1.1)},idle,-,-`, at('PUT_BED'));
check('island: the one far off, by Annholm\'s token', at('PUT_FAR') === `${f2(A[0] + 0.5)},${f2(A[1] + 1.5)},idle`, at('PUT_FAR'));
check('island: the one at work on its ground, where it was', at('PUT_AT') === `${f2(A[0] + 1.5)},${f2(A[1] + 0.5)}`, at('PUT_AT'));
check('island: and a second time, nobody', at('PUT_AGAIN') === '0', at('PUT_AGAIN'));

/* ---- in the browser ---------------------------------------------------------------------------------------------- */

const g = Game.create(4311);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = 0; y <= 127; y++) for (let x = 0; x <= 127; x++) { g.world.setHeight(x, y, 4); g.world.setTile(x, y, TileType.Grass, 0); }
g.player.x = A[0] + 0.5;
g.player.y = A[1] + 0.5;
g.deed = { name: 'Annholm', x: A[0], y: A[1], radius: 5, level: 5, mine: true };
g.neighbourDeeds = [
  { name: 'Bostead', x: B[0], y: B[1], radius: 5, level: 5, holder: 'Bo', mine: true, role: 'guest' as never },
  { name: 'Carholm', x: C[0], y: C[1], radius: 5, level: 5, holder: 'Cara' },
];
g.crates.clear();
for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
g.rand = () => 0.5;
const cr = g.creatures as unknown as Record<string, (...a: unknown[]) => unknown>;
const step = (c: Creature): void => void cr.updateWorker.call(g.creatures, c, 0.05, g);
const tired = (x: number, y: number, skill = 10): Creature => {
  const c = g.creatures.spawn('sedra', x, y, 'deed', g.rand, g.time - 3600 * 24 * 60);
  c.traits = [];
  c.rare = 0;
  c.care = 0;
  c.hunger = 1;
  c.stance = 'passive';
  c.skills = { foraging: skill };
  c.until = g.time - 1;
  c.worn = TIRE_GOES;
  return c;
};

const theirs = g.addFurniture('den_small', B[0], B[1], 0, 0, 40);
{
  const c = tired(A[0] + 0.5, A[1] + 0.5);
  step(c);
  check('browser: a tired worker, the only free bed on Bostead (its keeper a citizen): rests where it stands',
    c.state === 'rest' && c.bed === undefined && theirs.sleeper === undefined, `${c.state} ${c.bed}`);
  g.creatures.remove(c.id);
}
const home = g.addFurniture('den_small', A[0] - 3, A[1], 0, 0, 40);
{
  const c = tired(A[0] + 0.5, A[1] + 0.5);
  step(c);
  check('browser: with a free bed on Annholm, it walks to it', c.state === 'toBed' && c.bed === home.id, `${c.state} ${c.bed}/${home.id}`);
  g.creatures.remove(c.id);
}
{
  const p = g.addPost(POST[0], POST[1], 0, 0, 50);
  const c = tired(POST[0] + 0.5, POST[1] + 1.5);
  c.post = p.id;
  p.worker = c.id;
  step(c);
  check('browser: a tired worker on a post off every settlement, the Annholm bed free: rests where it stands',
    c.state === 'rest' && c.bed === undefined, `${c.state} ${c.bed}`);
  p.worker = null;
  g.creatures.remove(c.id);
}
{
  const c = tired(FAR[0] + 0.5, FAR[1] + 0.5);
  step(c);
  check('browser: a tired worker far off its ground, the Annholm bed free: rests where it stands', c.state === 'rest' && c.bed === undefined, `${c.state} ${c.bed}`);
  g.creatures.remove(c.id);
}
{
  const c = tired(A[0] + 0.5, A[1] + 0.5, 90);
  const rules = g.creatures as unknown as { gatherable: (g: Game, x: number, y: number, k: string, c: Creature) => boolean };
  for (const [x, y] of [[B[0] + 2, B[1] + 2], [C[0] + 2, C[1] + 2], [A[0] + 2, A[1] + 2], [45, 45]]) g.world.setTile(x, y, TileType.Tree, 0);
  const fell = [[B[0] + 2, B[1] + 2], [C[0] + 2, C[1] + 2], [A[0] + 2, A[1] + 2], [45, 45]].map(([x, y]) => rules.gatherable(g, x, y, 'woodcut', c));
  check('browser: no tree felled on Bostead or Carholm; on Annholm and off every settlement, yes', fell.join(',') === 'false,false,true,true', fell.join(','));
  const plant = (x: number, y: number): string => {
    const s = g.plantingSpot(x, y, 3, (px, py) => g.workerGround(px, py));
    return s ? `${s.x},${s.y}` : '-';
  };
  check('browser: nothing planted on Bostead or Carholm; off every settlement, yes',
    plant(B[0], B[1]) === '-' && plant(C[0], C[1]) === '-' && plant(80, 80) !== '-', `${plant(B[0], B[1])} ${plant(C[0], C[1])} ${plant(80, 80)}`);
  check('browser: Bostead is the keeper\'s (`onDeed`), not its workers\' (`onHomeDeed`)',
    g.onDeed(B[0], B[1]) && !g.onHomeDeed(B[0], B[1]) && g.onHomeDeed(A[0], A[1]));
  g.creatures.remove(c.id);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a settlement's worker keeps to its own settlement — ${ok.length} of ${ok.length}`);
