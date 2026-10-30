-- The Springlet: a water mount, slow on land, a hare's pace in water, found only in deep water.
--
-- Asked: "Add a new wildermon line. This is a water mount that walks very slowly on land (unmounted player walking
-- speed .5) but operates same speed as a hare mount when swimming in water. Rarely found, only spawns in deep water.
-- Eats fish. Requires saddle and bridle to mount like land mount". Springlet, Springsail, Tidecourser. Its row, its
-- diet, its weight in the wild and its two new columns come with the definitions (`species_def.swim_speed`,
-- `deep_water`); this is the rules that read them.
--
-- In water is a tile with any water over the middle of its bed, the sea's or a pond's, however shallow (`water_over`,
-- the browser's `waterOver`). A rider on a kind with a water pace of its own goes, on land, at the kind's own speed
-- and nothing else -- no age, blood, climbing, belly, shoes or tack -- and in water by the mount rule on its water pace
-- (`travel_speed`, `mount_speed`; the browser's `Game.mountSpeed`). Deep water is a tile more than a swimmer's depth
-- under the water over it (`deep_tile`, the browser's `deepTile`): a kind of the deep water is put down only there
-- (`suits`, `site_for`) and its wild legs keep to it (`creature_settle`, `deep_line`). A mount that is not a draught
-- beast has climbing for its level, learned under a rider (`level_skill`, the browser's `levelSkill`).

set local lock_timeout = '3s';

-- Before the definitions that fill them: the function bodies below read them.
alter table species_def add column if not exists swim_speed real;
alter table species_def add column if not exists deep_water boolean not null default false;

/* In water: any water over the middle of a tile's bed. The browser's `waterOver`. */
create or replace function water_over(p_world uuid, p_x int, p_y int) returns boolean
language sql stable as $$
  select water_bed(p_world, p_x, p_y) < water_surface(p_world, p_x, p_y)
$$;

/*
 * Deep water a kind of it is put down on and keeps to: on the island, not on piers, and more than `swim_depth` of
 * water over the middle of its bed. The browser's `deepTile`.
 */
create or replace function deep_tile(p_world uuid, p_x int, p_y int) returns boolean
language sql stable as $$
  select in_bounds(p_world, p_x, p_y)
     and water_bed(p_world, p_x, p_y) < water_surface(p_world, p_x, p_y) - swim_depth()
     and not on_piers(p_world, p_x, p_y)
$$;

/* A wild leg for a kind of the deep water: every tile on the way is deep water (`deep_tile`), as `line_clear` asks of ground. */
create or replace function deep_line(p_world uuid, p_x0 double precision, p_y0 double precision,
                                     p_x1 double precision, p_y1 double precision) returns boolean
language plpgsql stable as $$
declare n int; i int; t double precision; tx int; ty int; lx int; ly int;
begin
  n := greatest(1, ceil(2 * sqrt(power(p_x1 - p_x0, 2) + power(p_y1 - p_y0, 2)))::int);
  for i in 0..n loop
    t := i::double precision / n;
    tx := floor(p_x0 + (p_x1 - p_x0) * t)::int;
    ty := floor(p_y0 + (p_y1 - p_y0) * t)::int;
    if tx is distinct from lx or ty is distinct from ly then
      if not deep_tile(p_world, tx, ty) then return false; end if;
      lx := tx; ly := ty;
    end if;
  end loop;
  return true;
end $$;

/* A mount's pace by the mount rule on a pace of its own (`p_speed`): its kind's, or its water pace in water. */
create or replace function mount_speed(c creature, p_speed double precision) returns double precision
language sql stable as $$
  select least(max_mount_speed(),
    p_speed * (age_row(c.born, old_of(c), age_pace(c))).speed * beast_mul(c, 'speed')
    * footing(beast_climb(c)) * (0.6 + 0.4 * c.hunger))
$$;

create or replace function mount_speed(c creature) returns double precision
language sql stable as $$
  select mount_speed(c, (select speed from species_def where id = c.species))
$$;

-- A rider: on a kind with a water pace, its own speed on land, flat, and the mount rule on its water pace in water.
do $do$
declare v text; v_n int;
  v_old1 text := $o$declare c creature; p placed; v double precision; pl player;$o$;
  v_new1 text := $n$declare c creature; p placed; v double precision; pl player; v_swim double precision;$n$;
  v_old2 text := $o$    select * into pl from player where world_id = p_world and uid = p_uid;
    -- The cap comes after the shoes, as the browser has it: a mount at the cap is at the cap.
    -- And quicker again in tack its maker's hand is in (a Tailor's Saddler), past the cap, as a vehicle's mark is.
    return least(max_mount_speed(), mount_speed(c) * case$o$;
  v_new2 text := $n$    select * into pl from player where world_id = p_world and uid = p_uid;
    /*
     * A kind with a water pace of its own (`swim_speed`; asked for: "walks very slowly on land (unmounted player
     * walking speed .5) but operates same speed as a hare mount when swimming in water"): on land its own speed, flat,
     * whatever its age, blood, climbing, belly, shoes or tack; in water (`water_over`) the rule below on its water pace.
     */
    select d.swim_speed, d.speed into v_swim, v from species_def d where d.id = c.species;
    if v_swim is not null and not water_over(p_world, floor(pl.x)::int, floor(pl.y)::int) then return v; end if;
    -- The cap comes after the shoes, as the browser has it: a mount at the cap is at the cap.
    -- And quicker again in tack its maker's hand is in (a Tailor's Saddler), past the cap, as a vehicle's mark is.
    return least(max_mount_speed(), case when v_swim is null then mount_speed(c) else mount_speed(c, v_swim) end * case$n$;
begin
  select pg_get_functiondef('travel_speed(uuid,uuid)'::regprocedure) into v;
  v_n := (length(v) - length(replace(v, v_old1, ''))) / length(v_old1);
  if v_n <> 1 then raise exception 'travel_speed has % of the declarations to change, not 1', v_n; end if;
  v_n := (length(v) - length(replace(v, v_old2, ''))) / length(v_old2);
  if v_n <> 1 then raise exception 'travel_speed has % of the mount lines to change, not 1', v_n; end if;
  execute replace(replace(v, v_old1, v_new1), v_old2, v_new2);
end $do$;

-- Put down only in deep water: the ground it suits, and where a place is looked for when the roll lands on dry ground.
do $do$
declare v text; v_n int;
  v_old text := $o$  if d.on_ore then
    if (bedrock_at(p_world, p_x, p_y)).ore is not true then return false; end if;$o$;
  v_new text := $n$  -- A kind of the deep water, only there (`deep_tile`; asked for: "only spawns in deep water").
  if d.deep_water then
    if not deep_tile(p_world, p_x, p_y) then return false; end if;
  elsif d.on_ore then
    if (bedrock_at(p_world, p_x, p_y)).ore is not true then return false; end if;$n$;
begin
  select pg_get_functiondef('suits(uuid,text,integer,integer)'::regprocedure) into v;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'suits has % of the lines to change, not 1', v_n; end if;
  execute replace(v, v_old, v_new);
end $do$;

do $do$
declare v text; v_n int;
  v_old1 text := $o$declare i int; v_x int; v_y int; v_looks int := 0;
begin$o$;
  v_new1 text := $n$declare i int; v_x int; v_y int; v_looks int := 0;
        -- A kind of the deep water looks at deep water rather than at ground (`deep_tile`).
        v_deep boolean := coalesce((select deep_water from species_def where id = p_species), false);
begin$n$;
  v_old2 text := $o$    if not creature_tile_ok(p_world, v_x, v_y) then continue; end if;
    if centre_height(p_world, v_x, v_y) < 2 or on_deed(p_world, v_x, v_y) then continue; end if;
    v_looks := v_looks + 1;$o$;
  v_new2 text := $n$    if v_deep then
      if not deep_tile(p_world, v_x, v_y) or on_deed(p_world, v_x, v_y) then continue; end if;
    else
      if not creature_tile_ok(p_world, v_x, v_y) then continue; end if;
      if centre_height(p_world, v_x, v_y) < 2 or on_deed(p_world, v_x, v_y) then continue; end if;
    end if;
    v_looks := v_looks + 1;$n$;
begin
  select pg_get_functiondef('site_for(uuid,integer,integer,integer,integer,text,integer)'::regprocedure) into v;
  v_n := (length(v) - length(replace(v, v_old1, ''))) / length(v_old1);
  if v_n <> 1 then raise exception 'site_for has % of the declarations to change, not 1', v_n; end if;
  v_n := (length(v) - length(replace(v, v_old2, ''))) / length(v_old2);
  if v_n <> 1 then raise exception 'site_for has % of the looks to change, not 1', v_n; end if;
  execute replace(replace(v, v_old1, v_new1), v_old2, v_new2);
end $do$;

-- Its wild legs: in deep water and nowhere else, at its water pace there.
do $do$
declare v text; v_n int;
  v_old1 text := $o$    pace := d.speed * a.speed * beast_mul(c, 'speed') * 0.7;$o$;
  v_new1 text := $n$    -- In water, a kind with a water pace of its own goes at that (`swim_speed`, `water_over`).
    pace := case when d.swim_speed is not null and water_over(p_world, floor(c.to_x)::int, floor(c.to_y)::int)
                 then d.swim_speed else d.speed end * a.speed * beast_mul(c, 'speed') * 0.7;$n$;
  v_old2 text := $o$        if creature_tile_ok(p_world, floor(nx)::int, floor(ny)::int)
           and line_clear(p_world, c.to_x, c.to_y, nx, ny) then ok := true; exit; end if;$o$;
  v_new2 text := $n$        -- A kind of the deep water keeps to it, the whole way (`deep_line`).
        if (case when d.deep_water then deep_line(p_world, c.to_x, c.to_y, nx, ny)
                 else creature_tile_ok(p_world, floor(nx)::int, floor(ny)::int)
                      and line_clear(p_world, c.to_x, c.to_y, nx, ny) end) then ok := true; exit; end if;$n$;
begin
  select pg_get_functiondef('creature_settle(uuid,integer)'::regprocedure) into v;
  v_n := (length(v) - length(replace(v, v_old1, ''))) / length(v_old1);
  if v_n <> 1 then raise exception 'creature_settle has % of the paces to change, not 1', v_n; end if;
  v_n := (length(v) - length(replace(v, v_old2, ''))) / length(v_old2);
  if v_n <> 1 then raise exception 'creature_settle has % of the leg checks to change, not 1', v_n; end if;
  execute replace(replace(v, v_old1, v_new1), v_old2, v_new2);
end $do$;

/*
 * The skill a kind's level is: its trade's, its own, what a draught beast keeps in the traces, or the climbing a
 * mount learns under a rider (`rpc_move`'s `worker_learn` of `haul_skill`). The browser's `levelSkill`.
 */
create or replace function level_skill(p_species text) returns text
language sql stable as $$
  select coalesce((select g.skill from gather_def g where g.id = sd.gathers), sd.learns,
                  case when sd.draught or sd.mount is not null then haul_skill() end)
    from species_def sd where sd.id = p_species
$$;

select private.lock_doors();
