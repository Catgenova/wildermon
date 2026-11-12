-- A settlement's worker keeps to its own settlement: its beds, its work, its stores and what lies on it.
--
-- Reported: "wildermon beds will attract wildermon from across the map, breaking them and making them walk across
-- oceans to go sleep and then they cant return. They should only attract wildermon working on the settlement to which
-- the beds belong". A tired worker took the nearest free bed of its size on its keeper's settlement (`free_bed`),
-- whatever it worked for and wherever it stood: a worker on a post or round its keeper anywhere on the map, or a
-- settlement worker off its ground, walked one straight leg to it, over the sea (`worker_settle`, phase `bed`). Up
-- again, it walks back to its ground by `chase_leg`, round water, which finds no way across: it stood `far` for good,
-- a leg refused every 4 seconds.
--
-- Now a bed is for a worker of that settlement on its ground: no post, not round its keeper, and within its range and
-- `home_slack` of the totem, the same test that walks one home. Anything else rests where it stands (`rest_for`),
-- then walks home. A bed it set out for is taken only while that still holds and the bed is still on its settlement.
--
-- And reported: "wildermon are still leaving settlement to go work on other settlements or steal their materials".
-- The earlier fixes (20261029010000 a stoker's hearths, 20261029020000 the hod, and the trades after them) kept a
-- worker's work to `on_my_deed`, which is any settlement its keeper founded or is a citizen of (`deeds_of`): a worker of
-- somebody who is a citizen next door picked up what lay on the neighbour's ground, stoked, cooked, brewed, pressed,
-- smelted and hodded there, and took a bed there. And a gathering trade (woodcutting, mining, digging, picking, a hive,
-- farming) asked nothing of whose ground it was: any tile in its range, on anybody's settlement.
--
-- One rule now, read by all of it. A worker's settlement is its keeper's home (`my_deed`, as `work_site`):
--
--   on_home_deed           its settlement covers the tile: beds, fetching, compost, hearths, stations, the hod, stores
--   private.worker_ground  its settlement covers the tile, or no settlement does: what it gathers, where it plants, and
--                          the stores it fills beside a post (`worker_may`)
--
-- The stores it takes from and eats from were its home's already (20261029030000, 20261029020000). The browser keeps
-- the same rules (`Game.onHomeDeed`, `Game.workerGround`, `freeBed`).
--
-- Then the wildermon this left stranded: every settlement worker off its ground or in or walking to a bed it may not
-- use is put back at its post, beside its keeper (round its keeper), or by its settlement's token, its bed let go,
-- standing idle, still tired if it was (`private.workers_put_home`). Once, here, on every island.

set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

/** Whether a worker of this keeper's is on its own settlement there: the keeper's home (`my_deed`), no other. */
create or replace function on_home_deed(p_world uuid, p_uid uuid, p_x integer, p_y integer) returns boolean
language sql stable as $fn$
  select coalesce((select deed_covers(d, p_x, p_y) from my_deed(p_world, p_uid) d where d.world_id is not null), false)
$fn$;

/** Whether a worker of this keeper's may work a tile: on its own settlement, or on none. */
create or replace function private.worker_ground(p_world uuid, p_uid uuid, p_x integer, p_y integer) returns boolean
language sql stable as $fn$
  select on_home_deed(p_world, p_uid, p_x, p_y)
      or not exists (select 1 from deed d where d.world_id = p_world and deed_covers(d, p_x, p_y))
$fn$;
revoke execute on function private.worker_ground(uuid, uuid, integer, integer) from public;

-- Every rule of a worker's that asked `on_my_deed` of its keeper: its keeper's home only.
do $do$
declare r record;
begin
  for r in select * from (values
    ('anvil_target(uuid,creature,double precision,double precision)', 1),
    ('ash_target(uuid,creature,double precision,double precision)', 1),
    ('brew_target(uuid,creature,brew_def,double precision,double precision)', 1),
    ('cook_target(uuid,creature,double precision,double precision)', 1),
    ('damaged_in_stores(uuid,uuid)', 1),
    ('errand_do(uuid,integer,boolean,text)', 14),
    ('fill_buckets(uuid,creature)', 1),
    ('furnace_target(uuid,creature,text,boolean,double precision,double precision)', 1),
    ('glass_target(uuid,creature,double precision,double precision)', 1),
    ('green_on_tile(uuid,uuid,integer,integer)', 1),
    ('hod_work_mine(uuid,uuid,text,integer,integer)', 3),
    ('lamp_target(uuid,creature,boolean,double precision,double precision)', 1),
    ('lily_spot(uuid,creature)', 1),
    ('planter_target(uuid,creature,boolean,double precision,double precision)', 1),
    ('press_target(uuid,creature,double precision,double precision)', 1),
    ('scrub_tile(uuid,uuid,integer,integer)', 1),
    ('station_target(uuid,creature,text,double precision,double precision)', 1),
    ('stoke_hearth(uuid,creature,text,integer,integer,integer,boolean)', 1),
    ('thirsty_vessel(uuid,uuid)', 1),
    ('vine_target(uuid,creature,double precision,double precision)', 1),
    ('water_source(uuid,integer,integer,integer,creature)', 1),
    ('worker_gatherable(uuid,integer,integer,text,creature)', 2)
  ) as t(sig, n) loop
    perform pg_temp.patch_fn(('public.' || r.sig)::regprocedure, 'on_my_deed(', 'on_home_deed(', r.n);
  end loop;
end $do$;

-- What it gathers: on its own settlement or on none, a hive among it.
select pg_temp.patch_fn('public.worker_gatherable(uuid,integer,integer,text,creature)'::regprocedure,
  $o$begin
  if p_kind = 'hive' then$o$,
  $n$begin
  -- Never on another settlement, a citizen's or a stranger's (`private.worker_ground`).
  if c.keeper is not null and not private.worker_ground(p_world, c.keeper, p_x, p_y) then return false; end if;
  if p_kind = 'hive' then$n$);

-- Where a planter plants: the same.
drop function if exists planting_spot(uuid, integer, integer, integer);
create function planting_spot(p_world uuid, p_cx integer, p_cy integer, p_range integer, p_keeper uuid default null)
 returns table(x integer, y integer)
 language plpgsql
 stable
as $function$
declare ring int; spot record;
begin
  for ring in 1..p_range loop
    for spot in
      select p_cx + dx as gx, p_cy + dy as gy
      from generate_series(-ring, ring) dx, generate_series(-ring, ring) dy
      where greatest(abs(dx), abs(dy)) = ring
      order by random()
    loop
      if (p_keeper is null or private.worker_ground(p_world, p_keeper, spot.gx, spot.gy))
         and plantable_tile(p_world, spot.gx, spot.gy)
         and not exists (
           select 1 from generate_series(spot.gx - 1, spot.gx + 1) nx,
                        generate_series(spot.gy - 1, spot.gy + 1) ny
           where land_tile(p_world, nx, ny) = tile_id('Tree')) then
        x := spot.gx; y := spot.gy;
        return next;
        return;
      end if;
    end loop;
  end loop;
  return;
end $function$;
select pg_temp.patch_fn('public.errand_step(uuid,integer,text)'::regprocedure,
  $o$planting_spot(p_world, dd.x, dd.y, rng)$o$, $n$planting_spot(p_world, dd.x, dd.y, rng, c.keeper)$n$);

-- The stores it fills, beside a post or where it unloads: on its own settlement or on none.
create or replace function private.worker_may(p_world uuid, p_uid uuid, p_made_by uuid, p_store_of uuid, p_x integer, p_y integer)
returns boolean language sql stable as $f$
  select private.worker_ground(p_world, p_uid, p_x, p_y)
     and ((store_kept(p_world, p_store_of, p_x, p_y)).founded_by is not null
      or coalesce(p_made_by = p_uid, false)
      or (deed_may_at(p_world, p_uid, p_x, p_y, power_bit('stores'))
          and exists (select 1 from deed d
                       where d.world_id = p_world and deed_covers(d, p_x, p_y)
                         and (d.founded_by = p_uid or exists (select 1 from deed_member m where m.world_id = p_world
                                                                and m.founder = d.founded_by and m.uid = p_uid))
                         and (p_made_by is null or p_made_by = d.founded_by
                              or exists (select 1 from deed_member m where m.world_id = p_world
                                           and m.founder = d.founded_by and m.uid = p_made_by)))))
$f$;
revoke execute on function private.worker_may(uuid, uuid, uuid, uuid, integer, integer) from public;

-- What a post's worker eats from beside its post: the same.
select pg_temp.patch_fn('public.worker_feed(uuid,integer,double precision)'::regprocedure,
  $o$then abs(k.x - v_px) <= v_pr and abs(k.y - v_py) <= v_pr and k.made_by = c.keeper$o$,
  $n$then abs(k.x - v_px) <= v_pr and abs(k.y - v_py) <= v_pr and k.made_by = c.keeper
                       and private.worker_ground(p_world, c.keeper, k.x, k.y)$n$);
select pg_temp.patch_fn('public.worker_feed(uuid,integer,double precision)'::regprocedure,
  $o$then abs(p.x - v_px) <= v_pr and abs(p.y - v_py) <= v_pr and p.made_by = c.keeper$o$,
  $n$then abs(p.x - v_px) <= v_pr and abs(p.y - v_py) <= v_pr and p.made_by = c.keeper
                       and private.worker_ground(p_world, c.keeper, p.x, p.y)$n$);

/*
 * The nearest wildermon bed on its settlement that is free and of its own class (`freeBed`), for a worker of that
 * settlement on its ground: no post, not round its keeper, within its range and `home_slack` of the totem.
 */
create or replace function free_bed(p_world uuid, c creature, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.*
    from deed_of(p_world, c.keeper) dd
    join placed p on p.world_id = p_world and p.kind = 'furniture'
                 and p.x between dd.x - dd.radius and dd.x + dd.radius
                 and p.y between dd.y - dd.radius and dd.y + dd.radius
    join furniture_def fd on fd.id = p.sub
   where dd.world_id is not null and fd.den = den_class(c) and p.sleeper is null
     and c.post is null and c.around is null
     and greatest(abs(dd.x + 0.5 - p_x), abs(dd.y + 0.5 - p_y)) <= work_range(c) + home_slack()
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id
   limit 1
$fn$;

-- A bed it set out for: still on its settlement, and it still a worker of it.
select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$                  where b.id = c.bed and b.world_id = p_world and b.sleeper is null and fd.den = den_class(c)) then$o$,
  $n$                  where b.id = c.bed and b.world_id = p_world and b.sleeper is null and fd.den = den_class(c)
                    and c.post is null and c.around is null and on_home_deed(p_world, c.keeper, b.x, b.y)) then$n$);

/*
 * Every settlement worker (`mode` deed) of a world, or of every world, standing idle off its ground, or in or walking
 * to a bed it may not use (on a post, round its keeper, off its ground, or a bed off its settlement), put back: at its
 * post, where a worker set to a post stands; beside its keeper, round its keeper; else by its settlement's token,
 * where one sent back to the settlement stands (`worker_return`). Its bed let go, standing idle, still tired if it was.
 * How many.
 */
create or replace function private.workers_put_home(p_world uuid default null) returns int
language plpgsql as $f$
declare c creature; s record; cx double precision; cy double precision; v_x double precision; v_y double precision;
        v_off boolean; v_bed boolean; n int := 0;
begin
  for c in select * from creature k
            where k.mode = 'deed' and k.health > 0 and k.phase in ('idle', 'bed', 'rest')
              and (p_world is null or k.world_id = p_world)
            order by k.world_id, k.id for update loop
    select * into s from work_site(c.world_id, c);
    if s.x is null then continue; end if;
    cx := creature_x(c); cy := creature_y(c);
    v_off := greatest(abs(s.x + 0.5 - cx), abs(s.y + 0.5 - cy)) > s.radius + home_slack();
    v_bed := c.bed is not null
             and (c.post is not null or c.around is not null
                  or not exists (select 1 from placed b where b.id = c.bed and on_home_deed(c.world_id, c.keeper, b.x, b.y)));
    if not (v_off or v_bed) then continue; end if;
    v_x := null;
    if s.post is not null then
      select p.cx, p.cy + 0.6 into v_x, v_y from placed p where p.id = s.post;
    elsif c.around is not null then
      select pl.x, pl.y into v_x, v_y from player pl where pl.world_id = c.world_id and pl.uid = c.keeper;
    end if;
    if v_x is null then v_x := s.x + 0.5; v_y := s.y + 1.5; end if;
    update placed set sleeper = null where id = c.bed and sleeper = c.id;
    update creature set from_x = v_x, from_y = v_y, to_x = v_x, to_y = v_y, storey = 0, storey_from = 0, way = null,
           leg_at = now(), leg_ends = now(), until = now(), phase = 'idle', bed = null,
           idle_why = null, idle_n = null, idle_what = null
     where world_id = c.world_id and id = c.id;
    n := n + 1;
  end loop;
  return n;
end $f$;
revoke execute on function private.workers_put_home(uuid) from public;

-- The wildermon stranded so far, once.
do $live$
declare n int;
begin
  n := private.workers_put_home();
  raise notice 'workers put back on their own ground: %', n;
end $live$;

select private.lock_doors();
