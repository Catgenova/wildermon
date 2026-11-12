/**
 * Work around me: a wildermon works its trade within its work range of its keeper, into storage in reach.
 *
 * Asked for: "Allow wildermon to Work Around Me, provided there is storage nearby (carts and wagons and accessible
 * boats included)", and "It is an action of the player. The player is the focal point, not a work post or the
 * settlement totem ... It ends when the player cancels the action, or goes offline ... Each wildermon that was working
 * around them then goes back to where it came from"; and then "Capped to only the wildermon following you". Asked of
 * the island and of the browser:
 *
 *   * a forager round its keeper with a cart beside them puts its loads in the cart;
 *   * one with a boat its keeper owns puts them in the boat;
 *   * with no storage in reach it does not work, and says so ("no storage within its range of you"), nothing dropped;
 *   * with its storage full it holds its load and says so, nothing dropped;
 *   * its keeper walks thirty tiles: its ground is their new tile, and it follows;
 *   * a trade at the stores (a rippa sawing) takes its logs out of a wagon and puts the planks back in it;
 *   * a crate its keeper may not put into is not used;
 *   * only the one following you, and one at a time: one in a crate, and a second while one works, refused;
 *   * Stop: back to following;
 *   * its keeper offline (away, or not seen for `idle_logout`): the island does the same, in the clock and at its settle;
 *   * something else following by then: the fallback a post's worker has, the empty crate in the pack;
 *   * the trades worked round you, and the refusals, the same on both sides.
 *
 * The island half makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { AROUND_ACTION_BY_ID, AROUND_MOST, AROUND_STOPPED, aroundTrade } from '../../src/game/around';
import { GATHER_VERB, HOME_SLACK, SPECIES, workRangeOf, type Creature, type GatherKind } from '../../src/game/creatures';
import { shutIn } from '../../src/game/creaturecrate';
import { furnitureRoom } from '../../src/game/furniture';
import { POST_FOLLOW_REACH } from '../../src/game/posts';
import { idleSays } from '../../src/game/workerlog';
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
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const U = '7e5b0000-0000-4000-8000-0000000a0001';
const S = '7e5b0000-0000-4000-8000-0000000a0002';
const WALK = 30;

/* ---- the island ----------------------------------------------------------- */

const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.run(w uuid, p_id int, n int) returns void language plpgsql as $r$
declare i int;
begin
  -- Five minutes of the clock a time, as the stir would find it, rested and fed.
  for i in 1..n loop
    update creature set until = now() - interval '300 seconds', settled_at = now() - interval '300 seconds',
           leg_at = now() - interval '301 seconds', leg_ends = now() - interval '300 seconds', from_x = to_x, from_y = to_y,
           worn = 0, hunger = 1
     where world_id = w and id = p_id and mode = 'deed';
    perform worker_settle(w, p_id);
  end loop;
end $r$;
create function pg_temp.at(w uuid, u uuid, x double precision, y double precision) returns void language sql as $a$
  update player set x = $3, y = $4, body_at = now(), swim_at = now(), seen_at = now(), away = false where world_id = $1 and uid = $2;
$a$;
create function pg_temp.pet(w uuid, u uuid, kind text, x double precision, y double precision) returns int language plpgsql as $p$
declare v int;
begin
  v := creature_spawn(w, kind, x, y, 'active', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, form_size = null, name = 'Pip' || v where world_id = w and id = v;
  return v;
end $p$;
create function pg_temp.piece(w uuid, u uuid, sub text, x int, y int) returns bigint language sql as $f$
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values ($1, 'furniture', $3, $4, $5, 0, 0, $4 + (select fd.w from furniture_def fd where fd.id = $3) / 2.0,
            $5 + (select fd.h from furniture_def fd where fd.id = $3) / 2.0, 40, $2)
  returning id;
$f$;
create function pg_temp.crated(w uuid, u uuid, v int) returns bigint language plpgsql as $c$
declare v_crate bigint;
begin
  v_crate := give(w, u, 'creature_crate', 1, 40, null);
  update item set creature = v where id = v_crate;
  update creature set mode = 'stored' where world_id = w and id = v;
  return v_crate;
end $c$;
create function pg_temp.inside(p bigint) returns text language sql as $i$
  select coalesce(string_agg(def || 'x' || count, ',' order by def), 'empty') from item where placed = $1 and holder = 'furniture';
$i$;
do $t$
declare w uuid; u uuid := '${U}'; s uuid := '${S}';
        v_a int; v_b int; v_cart bigint; v_boat bigint; v_wagon bigint; v_x bigint; v_y bigint; j jsonb; c creature;
        v_ground int; v_was double precision; v_i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Around', 301, 240, 40, 40, true) returning id into w;
  perform land_blank(w, 240);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 239) x, generate_series(10, 230) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  v_ground := (select count(*) from item where world_id = w and holder = 'ground');

  insert into said select 'TRADES', string_agg(id, ',' order by id) from gather_def where around_trade(id);

  -- A forager round its keeper: no storage, then a cart.
  perform pg_temp.at(w, u, 40.5, 40.5);
  v_a := pg_temp.pet(w, u, 'rabba', 41.5, 40.5);
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a));
  insert into said values ('A_ACT', coalesce(j->>'done', j->>'why'));
  insert into said select 'A_ROW', mode || '|' || (around->>'was') || '|' || work_range(k) from creature k where world_id = w and id = v_a;
  insert into said select 'A_ROLL', workers_on_deed(w, u)::text;
  perform pg_temp.run(w, v_a, 1);
  insert into said select 'NOSTORE', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') || '|' || coalesce(carrying::text, 'empty')
    from creature where world_id = w and id = v_a;
  insert into said select 'NOSTORE_SENT', (e->>'idleWhy') || '|' || (e->>'idleN') || '|' || (e->>'idleAround') || '|' || (e->'around'->>'was')
    from jsonb_array_elements(rpc_creatures(w, 40)) e where (e->>'id')::int = v_a;
  v_cart := pg_temp.piece(w, u, 'cart', 43, 41);
  perform pg_temp.run(w, v_a, 6);
  insert into said values ('CART', pg_temp.inside(v_cart));
  insert into said select 'GROUND', (count(*) - v_ground)::text from item where world_id = w and holder = 'ground';
  -- Its keeper walks thirty tiles: its ground follows.
  select * into c from creature where world_id = w and id = v_a;
  v_was := creature_x(c);
  perform pg_temp.at(w, u, 40.5 + ${WALK}, 40.5);
  insert into said select 'SITE', s2.x || '|' || s2.y from creature k cross join lateral work_site(w, k) s2 where k.world_id = w and k.id = v_a;
  perform pg_temp.run(w, v_a, 2);
  select * into c from creature where world_id = w and id = v_a;
  insert into said values ('FOLLOWS', v_was || '|' || c.to_x);
  perform pg_temp.run(w, v_a, 12);
  select * into c from creature where world_id = w and id = v_a;
  insert into said values ('ARRIVED', greatest(abs(c.to_x - 70.5), abs(c.to_y - 40.5))::text || '|' || coalesce(c.idle_why, ''));
  delete from creature where world_id = w and id = v_a;

  -- One with a boat its keeper owns.
  perform pg_temp.at(w, u, 100.5, 40.5);
  v_a := pg_temp.pet(w, u, 'rabba', 101.5, 40.5);
  v_boat := pg_temp.piece(w, u, 'rowing_boat', 103, 41);
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a));
  perform pg_temp.run(w, v_a, 6);
  insert into said values ('BOAT', pg_temp.inside(v_boat));
  delete from creature where world_id = w and id = v_a;

  -- Storage full.
  perform pg_temp.at(w, u, 160.5, 40.5);
  v_a := pg_temp.pet(w, u, 'rabba', 161.5, 40.5);
  v_cart := pg_temp.piece(w, u, 'cart', 163, 41);
  perform furniture_add(w, v_cart, 'log', furniture_room((select p from placed p where p.id = v_cart), 'log'), 20, null);
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a));
  -- Until it has a load and finds the cart full: how many rounds that takes is the forage's dice (8 fell short once,
  -- live run 41527338387), so up to 40, seeded.
  perform setseed(0.25);
  for v_i in 1..40 loop
    perform pg_temp.run(w, v_a, 1);
    exit when (select idle_why from creature where world_id = w and id = v_a) = 'full';
  end loop;
  insert into said select 'FULL', coalesce(idle_why, '') || '|' || coalesce(carrying->>'def', 'empty') || '|' || pg_temp.inside(v_cart)
    from creature where world_id = w and id = v_a;
  insert into said select 'FULL_GROUND', (count(*) - v_ground)::text from item where world_id = w and holder = 'ground';
  insert into said select 'FULL_SENT', (e->>'idleWhy') || '|' || (e->>'idleAround')
    from jsonb_array_elements(rpc_creatures(w, 40)) e where (e->>'id')::int = v_a;
  delete from creature where world_id = w and id = v_a;

  -- A trade at the stores: a rippa sawing logs out of a wagon.
  perform pg_temp.at(w, u, 40.5, 100.5);
  v_a := pg_temp.pet(w, u, 'rippa', 41.5, 100.5);
  v_wagon := pg_temp.piece(w, u, 'wagon', 43, 101);
  perform furniture_add(w, v_wagon, 'log', 4, 30, null);
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a));
  insert into said values ('SAW_ACT', coalesce(j->>'done', j->>'why'));
  perform pg_temp.run(w, v_a, 4);
  insert into said values ('WAGON', pg_temp.inside(v_wagon));
  insert into said select 'SAW_IDLE', coalesce(idle_why, '') from creature where world_id = w and id = v_a;
  delete from creature where world_id = w and id = v_a;

  -- A crate its keeper may not put into.
  perform pg_temp.at(w, u, 100.5, 100.5);
  v_a := pg_temp.pet(w, u, 'rabba', 101.5, 100.5);
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by) values (w, 77001, 'plank', 102, 100, 1, 1, s);
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a));
  perform pg_temp.run(w, v_a, 6);
  insert into said select 'SHUT', coalesce(idle_why, '') || '|' || (select count(*) from item i where i.world_id = w and i.crate = 77001)
    from creature where world_id = w and id = v_a;
  v_cart := pg_temp.piece(w, u, 'cart', 98, 101);
  perform pg_temp.run(w, v_a, 6);
  insert into said select 'SHUT_CART', (select count(*) from item i where i.world_id = w and i.crate = 77001) || '|' || (pg_temp.inside(v_cart) <> 'empty');
  delete from creature where world_id = w and id = v_a;

  -- Its keeper's own crate on a settlement: not storage round them; a cart of theirs on it, pulled by them, still is.
  delete from placed where world_id = w and id = v_cart;
  perform pg_temp.at(w, u, 100.5, 100.5);
  v_a := pg_temp.pet(w, u, 'rabba', 101.5, 100.5);
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by) values (w, 77002, 'plank', 102, 100, 1, 1, u);
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Crateham', 104, 100, 2, 1, s);
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a));
  perform pg_temp.run(w, v_a, 6);
  insert into said select 'DEED', coalesce(idle_why, '') || '|' || (select count(*) from item i where i.world_id = w and i.crate = 77002)
    from creature where world_id = w and id = v_a;
  v_cart := pg_temp.piece(w, u, 'cart', 103, 101);
  update placed set puller = u where world_id = w and id = v_cart;
  perform pg_temp.run(w, v_a, 6);
  insert into said select 'DEED_CART', (select count(*) from item i where i.world_id = w and i.crate = 77002) || '|' || (pg_temp.inside(v_cart) <> 'empty');
  delete from deed where world_id = w and name = 'Crateham';
  delete from creature where world_id = w and id = v_a;

  -- Stop: back to following. And one at a time: a second following it, refused while it works.
  perform pg_temp.at(w, u, 160.5, 100.5);
  v_a := pg_temp.pet(w, u, 'rabba', 161.5, 100.5);
  v_cart := pg_temp.piece(w, u, 'cart', 163, 101);
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a));
  insert into said select 'H_ROW', coalesce(j->>'done', j->>'why') || '|' || mode || '|' || (around->>'was') from creature where world_id = w and id = v_a;
  v_b := pg_temp.pet(w, u, 'rabba', 160.5, 101.5);
  insert into said values ('H_CAP', regexp_replace(coalesce(act_refusal(w, u, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_b)), 'none'), 'Pip[0-9]+', 'Pip', 'g'));
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_b));
  insert into said select 'H_CAP_ROW', coalesce(j->>'done', j->>'why', 'null') || '|' || mode || '|' || coalesce(around::text, 'null') from creature where world_id = w and id = v_b;
  delete from creature where world_id = w and id = v_b;
  perform pg_temp.run(w, v_a, 3);
  j := rpc_act(w, 'stop_work_around', jsonb_build_object('kind', 'creature', 'id', v_a));
  insert into said values ('H_STOP', coalesce(j->>'done', j->>'why'));
  insert into said select 'H_A', mode || '|' || coalesce(around::text, 'null') || '|' || coalesce(carrying::text, 'empty') from creature where world_id = w and id = v_a;
  insert into said select 'H_TOLD', string_agg(regexp_replace(text, 'Pip[0-9]+', 'Pip', 'g'), ' / ' order by n)
    from (select text, n from event where world_id = w and uid = u and text like 'Work around me stopped:%' order by n desc limit 1) e;
  insert into said select 'H_GROUND', (count(*) - v_ground)::text from item where world_id = w and holder = 'ground';
  insert into said values ('H_AGAIN', coalesce(act_refusal(w, u, 'stop_work_around', jsonb_build_object('kind', 'creature', 'id', v_a)), 'none'));
  -- And with it back, the next may go.
  v_b := pg_temp.pet(w, u, 'rabba', 160.5, 101.5);
  update creature set mode = 'stored' where world_id = w and id = v_a;
  insert into said values ('H_NEXT', coalesce(act_refusal(w, u, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_b)), 'none'));
  delete from creature where world_id = w and id in (v_a, v_b);

  -- Offline: the island does the same, in the clock.
  perform pg_temp.at(w, u, 40.5, 160.5);
  v_a := pg_temp.pet(w, u, 'rabba', 41.5, 160.5);
  v_cart := pg_temp.piece(w, u, 'cart', 43, 161);
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a));
  perform pg_temp.run(w, v_a, 2);
  update player set away = true where world_id = w and uid = u;
  insert into said values ('I_SWEPT', around_sweep(w)::text);
  insert into said select 'I_A', mode || '|' || coalesce(around::text, 'null') from creature where world_id = w and id = v_a;
  insert into said values ('I_TICK', (position('around_sweep(w.id)' in pg_get_functiondef('world_tick'::regproc)) > 0)::text);
  -- Logged out (not seen for idle_logout), at its own settle.
  update player set away = false, seen_at = now() - make_interval(secs => idle_logout() + 5) where world_id = w and uid = u;
  update creature set mode = 'deed', around = '{"was": "follow"}' where world_id = w and id = v_a;
  perform pg_temp.run(w, v_a, 1);
  insert into said select 'I_SETTLE', mode || '|' || coalesce(around::text, 'null') from creature where world_id = w and id = v_a;
  delete from creature where world_id = w and id = v_a;

  -- Something else following you by then: the fallback, the empty crate in the pack.
  perform pg_temp.at(w, u, 100.5, 160.5);
  v_a := pg_temp.pet(w, u, 'rabba', 101.5, 160.5);
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a));
  v_b := pg_temp.pet(w, u, 'rabba', 100.5, 161.5);
  v_y := give(w, u, 'creature_crate', 1, 40, null);
  j := rpc_act(w, 'stop_work_around', jsonb_build_object('kind', 'creature', 'id', v_a));
  insert into said select 'J_A', mode || '|' || coalesce((select (creature = v_a)::text from item where id = v_y), 'gone') || '|' || coalesce(around::text, 'none') from creature where world_id = w and id = v_a;
  insert into said select 'J_B', mode from creature where world_id = w and id = v_b;
  insert into said select 'J_TOLD', string_agg(regexp_replace(text, 'Pip[0-9]+', 'Pip', 'g'), ' / ' order by n)
    from (select text, n from event where world_id = w and uid = u and text like 'Work around me stopped:%' order by n desc limit 1) e;
  delete from creature where world_id = w and id in (v_a, v_b);
  delete from item where id = v_y;

  -- Refusals, each on one named Pip.
  perform pg_temp.at(w, u, 160.5, 160.5);
  v_a := pg_temp.pet(w, u, 'lungra', 161.5, 160.5);
  update creature set name = 'Pip' where world_id = w and id = v_a;
  insert into said values ('R_guard', coalesce(act_refusal(w, u, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a)), 'none'));
  update creature set keeper = s, species = 'rabba' where world_id = w and id = v_a;
  insert into said values ('R_stranger', coalesce(act_refusal(w, u, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a)), 'none'));
  update creature set keeper = u, mode = 'deed' where world_id = w and id = v_a;
  insert into said values ('R_worker', coalesce(act_refusal(w, u, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a)), 'none'));
  update creature set mode = 'active', from_x = 161.5 + ${POST_FOLLOW_REACH + 1}, to_x = 161.5 + ${POST_FOLLOW_REACH + 1} where world_id = w and id = v_a;
  insert into said values ('R_far', coalesce(act_refusal(w, u, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a)), 'none'));
  update creature set from_x = 161.5, to_x = 161.5 where world_id = w and id = v_a;
  v_x := pg_temp.crated(w, u, v_a);
  insert into said values ('R_crated', coalesce(act_refusal(w, u, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a)), 'none'));
  update item set creature = null where id = v_x;
  update creature set mode = 'deed', around = '{"was": "follow"}', from_x = 161.5, to_x = 161.5 where world_id = w and id = v_a;
  insert into said values ('R_already', coalesce(act_refusal(w, u, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_a)), 'none'));
  -- Assigned to the settlement: off work round its keeper, and on the roll.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Aroundstead', 200, 200, 10, 3, u);
  j := rpc_act(w, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v_a));
  insert into said select 'ASSIGN', coalesce(j->>'done', j->>'why') || '|' || mode || '|' || coalesce(around::text, 'null') || '|' || workers_on_deed(w, u)
    from creature where world_id = w and id = v_a;
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

/* ---- the browser ---------------------------------------------------------- */

const T = 60;
const work = AROUND_ACTION_BY_ID.get('work_around')!;
const stop = AROUND_ACTION_BY_ID.get('stop_work_around')!;
const fresh = (): { g: Game; said: string[] } => {
  const g = Game.create(301, 256);
  const w = g.world;
  w.water = null;
  w.heights.fill(10);
  w.tiles.fill(TileType.Grass);
  w.data.fill(0);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.deed = null;
  g.player.x = T + 0.5;
  g.player.y = T + 0.5;
  const said: string[] = [];
  const logOf = g.logMsg.bind(g);
  g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => {
    said.push(m);
    logOf(m, k);
  };
  return { g, said };
};
const pet = (g: Game, kind: string, x: number, y: number): Creature => {
  const c = g.creatures.spawn(kind, x, y, 'active', () => 0.5, -1e9);
  c.traits = [];
  c.name = 'Pip';
  return c;
};
const crateIn = (g: Game, c: Creature): number => {
  const it = { uid: g.inventory.nextUid++, id: 'creature_crate', ql: 40, dmg: 0, count: 1 };
  g.inventory.addItem(it);
  const held = g.inventory.items.find((x) => x.uid === it.uid)!;
  shutIn(g, c, held);
  return held.uid;
};
const run = (g: Game, cs: Creature[], secs: number): void => {
  const step = 0.25;
  const stepper = g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void };
  for (let t = 0; t < secs; t += step) {
    g.time += step;
    for (const c of cs) {
      if (c.mode !== 'deed') continue;
      c.hunger = 1;
      c.worn = 0;
      stepper.updateWorker(c, step, g);
    }
  }
};
const inside = (items: Array<{ id: string; count: number }>): number => items.reduce((n, it) => n + it.count, 0);
const groundCount = (g: Game): number => [...g.ground.values()].reduce((n, pile) => n + pile.length, 0);

// The trades worked round you, on both sides.
{
  const browser = (Object.keys(GATHER_VERB) as GatherKind[]).filter((k) => aroundTrade(k)).sort().join(',');
  check('the trades worked round you are the same on both sides', browser === isle.get('TRADES'), `browser ${browser} / island ${isle.get('TRADES')}`);
  check('none of them guarding, stoking, or an errand at a settlement station',
    !['guard', 'stoke', 'cook', 'smelt', 'kiln', 'hod', 'water', 'lamp'].some((k) => (isle.get('TRADES') ?? '').split(',').includes(k)));
}

// A forager round its keeper: no storage, then a cart.
{
  const { g } = fresh();
  const c = pet(g, 'rabba', T + 1.5, T + 0.5);
  const range = workRangeOf(c, SPECIES.rabba);
  check('the browser sets one following you to work round you', work.check?.({ kind: 'creature', id: c.id }, g) === null);
  work.perform({ kind: 'creature', id: c.id }, g);
  check('as a worker round you, not on any settlement\'s roll, on both sides',
    c.mode === 'deed' && c.around?.was === 'follow' && g.creatures.workers().length === 0
      && isle.get('A_ACT') === 'true' && isle.get('A_ROW') === `deed|follow|${range}` && isle.get('A_ROLL') === '0',
    `browser ${c.mode} ${c.around?.was} / island ${isle.get('A_ROW')} roll ${isle.get('A_ROLL')}`);
  run(g, [c], 5);
  const said = c.idle ? idleSays(c.idle, 'forage') : '';
  const [why, n, aroundFlag, came] = (isle.get('NOSTORE_SENT') ?? '').split('|');
  const islandSays = idleSays({ why: why as 'nostore', n: Number(n), around: aroundFlag === 'true' }, 'forage');
  check(`no storage in reach: idle, "${idleSays({ why: 'nostore', n: range, around: true }, 'forage')}", on both sides`,
    said === islandSays && c.idle?.why === 'nostore' && c.idle.n === range && (isle.get('NOSTORE') ?? '').startsWith(`nostore|${range}|empty`) && came === 'follow',
    `browser "${said}" / island "${islandSays}" ${isle.get('NOSTORE')}`);
  check('and nothing dropped: holding nothing, the ground bare', !c.carrying && groundCount(g) === 0);
  const cart = g.addFurniture('cart', T + 3, T + 1, 0, 0, 40, []);
  run(g, [c], 600);
  check('a cart beside its keeper: its loads go in the cart, on both sides',
    inside(cart.items) > 0 && isle.get('CART') !== 'empty' && groundCount(g) === 0 && isle.get('GROUND') === '0',
    `browser ${inside(cart.items)} in the cart, ground ${groundCount(g)} / island ${isle.get('CART')}, ground ${isle.get('GROUND')}`);
  // Its keeper walks thirty tiles.
  const was = c.x;
  g.player.x += WALK;
  const site = g.workSite(c);
  check(`its keeper walks ${WALK} tiles: its ground is their new tile, on both sides`,
    site?.x === T + WALK && site.y === T && isle.get('SITE') === `${40 + WALK}|40`, `browser ${site?.x},${site?.y} / island ${isle.get('SITE')}`);
  run(g, [c], 120);
  const [from, to] = (isle.get('FOLLOWS') ?? '').split('|').map(Number);
  const [left] = (isle.get('ARRIVED') ?? '').split('|').map(Number);
  check(`and it follows them, back to within its range and ${HOME_SLACK} more of them, on both sides`,
    c.x > was && Math.max(Math.abs(c.x - g.player.x), Math.abs(c.y - g.player.y)) <= range + HOME_SLACK && to > from && left <= range + HOME_SLACK,
    `browser ${was.toFixed(1)} → ${c.x.toFixed(1)} / island ${from.toFixed(1)} → ${to.toFixed(1)}, then ${left.toFixed(1)} off`);
}

// One with a boat its keeper owns.
{
  const { g } = fresh();
  const c = pet(g, 'rabba', T + 1.5, T + 0.5);
  const boat = g.addFurniture('rowing_boat', T + 3, T + 1, 0, 0, 40, []);
  work.perform({ kind: 'creature', id: c.id }, g);
  run(g, [c], 600);
  check('a boat its keeper owns: its loads go in the boat, on both sides', inside(boat.items) > 0 && isle.get('BOAT') !== 'empty',
    `browser ${inside(boat.items)} / island ${isle.get('BOAT')}`);
}

// Storage full.
{
  const { g } = fresh();
  const c = pet(g, 'rabba', T + 1.5, T + 0.5);
  const cart = g.addFurniture('cart', T + 3, T + 1, 0, 0, 40, []);
  const log = { uid: g.inventory.nextUid++, id: 'log', ql: 20, dmg: 0, count: 1 };
  cart.items.push({ ...log, count: furnitureRoom(cart, log) });
  work.perform({ kind: 'creature', id: c.id }, g);
  run(g, [c], 600);
  const [why, held] = (isle.get('FULL') ?? '').split('|');
  const sent = (isle.get('FULL_SENT') ?? '').split('|');
  check(`storage full: holds its load, "${idleSays({ why: 'full', n: 0, around: true }, 'forage', 'Acorn')}", on both sides`,
    c.idle?.why === 'full' && !!c.idle.around && !!c.carrying && why === 'full' && held !== 'empty' && sent[0] === 'full' && sent[1] === 'true',
    `browser ${c.idle?.why} ${c.carrying?.id} / island ${isle.get('FULL')} ${isle.get('FULL_SENT')}`);
  check('and nothing dropped, on both sides', groundCount(g) === 0 && isle.get('FULL_GROUND') === '0', `${groundCount(g)} / ${isle.get('FULL_GROUND')}`);
}

// A trade at the stores: sawing logs out of a wagon.
{
  const { g } = fresh();
  const c = pet(g, 'rippa', T + 1.5, T + 0.5);
  const wagon = g.addFurniture('wagon', T + 3, T + 1, 0, 0, 40, [{ uid: g.inventory.nextUid++, id: 'log', ql: 30, dmg: 0, count: 4 }]);
  check('the browser sets a rippa to saw round you', work.check?.({ kind: 'creature', id: c.id }, g) === null && isle.get('SAW_ACT') === 'true',
    `${work.check?.({ kind: 'creature', id: c.id }, g)} / ${isle.get('SAW_ACT')}`);
  work.perform({ kind: 'creature', id: c.id }, g);
  run(g, [c], 900);
  const planks = wagon.items.filter((it) => it.id === 'plank').reduce((n, it) => n + it.count, 0);
  const logs = wagon.items.filter((it) => it.id === 'log').reduce((n, it) => n + it.count, 0);
  check('its logs out of the wagon and the planks back in it, on both sides',
    planks === 12 && logs === 0 && isle.get('WAGON') === 'plankx12' && c.idle?.why === 'stock' && isle.get('SAW_IDLE') === 'stock',
    `browser ${planks} planks ${logs} logs, ${c.idle?.why} / island ${isle.get('WAGON')}, ${isle.get('SAW_IDLE')}`);
  check(`and when the logs are gone: "${idleSays({ why: 'stock', n: 0, around: true }, 'saw')}"`, !!c.idle && idleSays(c.idle, 'saw').includes('storage in reach'));
}

// A crate its keeper may not put into.
{
  const { g } = fresh();
  const c = pet(g, 'rabba', T + 1.5, T + 0.5);
  const crate = g.addCrate('plank', T + 2, T, 1, 1, []);
  crate.mine = false;
  work.perform({ kind: 'creature', id: c.id }, g);
  run(g, [c], 300);
  check('a crate its keeper may not put into is not storage: idle, no storage in reach, on both sides',
    c.idle?.why === 'nostore' && crate.items.length === 0 && isle.get('SHUT') === 'nostore|0', `browser ${c.idle?.why} ${crate.items.length} / island ${isle.get('SHUT')}`);
  const cart = g.addFurniture('cart', T - 2, T + 1, 0, 0, 40, []);
  run(g, [c], 600);
  check('and with a cart of its own beside it, everything goes in the cart, nothing in that crate, on both sides',
    crate.items.length === 0 && inside(cart.items) > 0 && isle.get('SHUT_CART') === '0|true', `browser ${crate.items.length} / ${inside(cart.items)}; island ${isle.get('SHUT_CART')}`);
}

// Its keeper's own crate on a settlement.
{
  const { g } = fresh();
  const c = pet(g, 'rabba', T + 1.5, T + 0.5);
  const crate = g.addCrate('plank', T + 2, T, 1, 1, []);
  g.neighbourDeeds.push({ name: 'Crateham', x: T + 4, y: T, radius: 2, level: 1, holder: null });
  work.perform({ kind: 'creature', id: c.id }, g);
  run(g, [c], 300);
  check('its keeper\'s own crate on a settlement is not storage: idle, no storage in reach, on both sides',
    c.idle?.why === 'nostore' && crate.items.length === 0 && isle.get('DEED') === 'nostore|0', `browser ${c.idle?.why} ${crate.items.length} / island ${isle.get('DEED')}`);
  const cart = g.addFurniture('cart', T + 3, T + 1, 0, 0, 40, []);
  cart.hitched = true;
  run(g, [c], 600);
  check('a cart its keeper pulls on that settlement still is: everything goes in the cart, nothing in the crate, on both sides',
    crate.items.length === 0 && inside(cart.items) > 0 && isle.get('DEED_CART') === '0|true', `browser ${crate.items.length} / ${inside(cart.items)}; island ${isle.get('DEED_CART')}`);
  g.neighbourDeeds.length = 0;
}

// Stop: back to following; one at a time.
{
  const { g, said } = fresh();
  const a = pet(g, 'rabba', T + 1.5, T + 0.5);
  g.addFurniture('cart', T + 3, T + 1, 0, 0, 40, []);
  work.perform({ kind: 'creature', id: a.id }, g);
  check('the one following you set to work round you, on both sides',
    a.mode === 'deed' && a.around?.was === 'follow' && isle.get('H_ROW') === 'true|deed|follow', `browser ${a.mode} ${a.around?.was} / island ${isle.get('H_ROW')}`);
  const b = pet(g, 'rabba', T + 0.5, T + 1.5);
  const cap = work.check?.({ kind: 'creature', id: b.id }, g) ?? null;
  check(`one at a time (${AROUND_MOST}): the next one following you refused, "${cap}", on both sides`,
    cap === 'Already working around you: Pip.' && isle.get('H_CAP') === cap, `browser "${cap}" / island "${isle.get('H_CAP')}"`);
  check('and not set to work on the island: still following', /^Already working around you: Pip[0-9]+\.\|active\|null$/.test(isle.get('H_CAP_ROW') ?? ''), isle.get('H_CAP_ROW'));
  g.creatures.remove(b.id);
  run(g, [a], 300);
  stop.perform({ kind: 'creature', id: a.id }, g);
  check('Stop: back to following you, on both sides', a.mode === 'active' && !a.around && (isle.get('H_A') ?? '').startsWith('active|null|empty'),
    `browser ${a.mode} / island ${isle.get('H_A')}`);
  const told = said.filter((m) => m.startsWith(`${AROUND_STOPPED}:`)).join(' / ');
  check('told in the same words on both sides', told === isle.get('H_TOLD') && told === `${AROUND_STOPPED}: Pip follows you.`, `browser "${told}" / island "${isle.get('H_TOLD')}"`);
  check('nothing it held dropped, on both sides', groundCount(g) === 0 && isle.get('H_GROUND') === '0', `${groundCount(g)} / ${isle.get('H_GROUND')}`);
  check('and Stop again is refused in the same words', stop.check?.({ kind: 'creature', id: a.id }, g) === isle.get('H_AGAIN'),
    `${stop.check?.({ kind: 'creature', id: a.id }, g)} / ${isle.get('H_AGAIN')}`);
  // Back and in a crate, the next one following may go.
  crateIn(g, a);
  const next = pet(g, 'rabba', T + 0.5, T + 1.5);
  const nextWhy = work.check?.({ kind: 'creature', id: next.id }, g) ?? null;
  check('with it stopped, the next one following may go, on both sides', nextWhy === null && isle.get('H_NEXT') === 'none', `${nextWhy} / ${isle.get('H_NEXT')}`);
}

// Offline: the island's.
check('its keeper away: the clock sends it back to following', isle.get('I_SWEPT') === '1' && isle.get('I_A') === 'active|null', `${isle.get('I_SWEPT')} ${isle.get('I_A')}`);
check('the clock runs that sweep every round', isle.get('I_TICK') === 'true');
check('its keeper not seen for the logout time: its own settle sends it back', isle.get('I_SETTLE') === 'active|null', isle.get('I_SETTLE'));

// Something else following by then.
{
  const { g, said } = fresh();
  const a = pet(g, 'rabba', T + 1.5, T + 0.5);
  work.perform({ kind: 'creature', id: a.id }, g);
  const b = pet(g, 'rabba', T + 0.5, T + 1.5);
  const spare = { uid: g.inventory.nextUid++, id: 'creature_crate', ql: 40, dmg: 0, count: 1 };
  g.inventory.addItem(spare);
  stop.perform({ kind: 'creature', id: a.id }, g);
  check('another following you by then: into the empty crate in your pack, as a post\'s worker goes, round nobody now, on both sides',
    a.mode === 'stored' && !a.around && g.inventory.items.find((it) => it.uid === spare.uid)?.creature === a.id && isle.get('J_A') === 'stored|true|none', `browser ${a.mode} ${a.around ? 'around' : 'nobody'} / island ${isle.get('J_A')}`);
  check('and the other still following, on both sides', b.mode === 'active' && isle.get('J_B') === 'active', `${b.mode} / ${isle.get('J_B')}`);
  const told = said.filter((m) => m.startsWith(`${AROUND_STOPPED}:`)).join(' / ');
  check('told in the same words on both sides', told === isle.get('J_TOLD'), `browser "${told}" / island "${isle.get('J_TOLD')}"`);
}

// Refusals.
{
  const { g } = fresh();
  const say = (kind: string, c: Partial<Creature>, crated = false): string | null => {
    const one = pet(g, kind, T + 1.5, T + 0.5);
    Object.assign(one, c);
    if (crated) crateIn(g, one);
    const why = work.check?.({ kind: 'creature', id: one.id }, g) ?? null;
    g.creatures.remove(one.id);
    return why;
  };
  const browser: Record<string, string | null> = {
    guard: say('lungra', {}),
    stranger: say('rabba', { mine: false }),
    worker: say('rabba', { mode: 'deed' }),
    far: say('rabba', { x: T + 1.5 + POST_FOLLOW_REACH + 1 }),
    crated: say('rabba', {}, true),
    already: say('rabba', { mode: 'deed', around: { was: 'follow' } }),
  };
  for (const [k, b] of Object.entries(browser)) {
    check(`refused, in the same words on both sides: ${k}`, !!b && isle.get(`R_${k}`) === b, `browser "${b}", island "${isle.get(`R_${k}`)}"`);
  }
  check('assigned to the settlement: off work round you, on its roll', isle.get('ASSIGN') === 'true|deed|null|1', isle.get('ASSIGN'));
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na wildermon works round its keeper — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
