set local lock_timeout = '3s';

-- A spiral staircase: a staircase with the hand 's' (`SPIRAL`). One tile a storey, wound round a post in the middle of
-- its tile, with no side it is climbed from: its tile is stepped onto and off at the storey it is walked on, across any
-- side, and a storey up or down it is a climb on the tile (`Game.liftRule`, `spiral_lift_ok`). Spirals on the same tile
-- a storey over a storey are one stair, down to a cellar too; a spiral stacks on a spiral only (`spiral_stack_refusal`).
-- It costs what a single staircase costs (`floor_bill`, `SINGLE_STAIRS_SHARE`), goes wherever one goes, outside a
-- building as well (`frame_outside_stair_refusal`), and is walked on foot only (`spiral_foot_said`).

alter table floor_tile drop constraint if exists floor_tile_hand_check;
alter table floor_tile add constraint floor_tile_hand_check check (hand is null or (hand in ('l', 'r', 's') and kind = 'stairs'));

/* The hand a plan names: a single staircase's half of the tile, or 's' for a spiral one; none for the wide one. */
create or replace function stair_hand(p_target jsonb, p_kind text)
  returns text language sql immutable as $$
  select case when p_kind = 'stairs' and p_target->>'hand' in ('l', 'r', 's') then p_target->>'hand' end
$$;

/* What a floor slot is called (`floorNameOf`): a staircase with a hand is a single one, or a spiral one. */
create or replace function floor_name(p_kind text, p_hand text)
  returns text language sql immutable as $$
  select case when p_kind = 'stairs' and p_hand = 's' then 'spiral staircase'
              when p_kind = 'stairs' and p_hand is not null then 'single staircase' else floor_kind_name(p_kind) end
$$;

/* Why a mount, a cart or a wagon goes no further than beside a spiral staircase (`SPIRAL_FOOT_SAID`). */
create or replace function spiral_foot_said() returns text language sql immutable as $$
  select 'Spiral staircase: on foot only.'::text
$$;

/* A finished spiral staircase in a tile's floor slot at a storey (`Game.spiralAt`). */
create or replace function spiral_at(p_world uuid, p_x int, p_y int, p_level int)
  returns boolean language sql stable as $$
  select exists (select 1 from floor_tile f where f.world_id = p_world and f.level = p_level and f.x = p_x and f.y = p_y
                   and f.kind = 'stairs' and f.hand = 's' and bill_done(f.needed))
$$;

/*
 * Whether a body goes from one storey to another on the same tile without leaving it, both on or over the ground: up
 * or down finished spiral staircases, one on every storey between (`Game.liftRule`). A cellar's are `cellar_move_ok`'s.
 */
create or replace function spiral_lift_ok(p_world uuid, p_x int, p_y int, p_from int, p_to int)
  returns boolean language sql stable as $$
  select p_from <> p_to and not exists (
    select 1 from generate_series(least(p_from, p_to) + 1, greatest(p_from, p_to)) k
     where not spiral_at(p_world, p_x, p_y, k))
$$;

/*
 * Why a word to `rpc_move` is held where the body was, or null: a mount, a cart or a wagon onto a spiral staircase's
 * tile, at its foot or its head (`spiral_foot_said`, said); or a change of storey on one tile with no spiral staircase
 * to climb it (`spiral_lift_ok`), which says nothing. On the word as it was asked, before any of it was held back.
 */
create or replace function spiral_move_refusal(p_world uuid, p_uid uuid, p_from int, p_to int,
                                               p_fx double precision, p_fy double precision, p_x double precision, p_y double precision)
  returns text language plpgsql stable as $$
declare v_x int := floor(p_x)::int; v_y int := floor(p_y)::int;
        v_same boolean := floor(p_x)::int = floor(p_fx)::int and floor(p_y)::int = floor(p_fy)::int;
begin
  if v_same and p_from = p_to then return null; end if;
  if p_to >= 0 and (spiral_at(p_world, v_x, v_y, p_to) or spiral_at(p_world, v_x, v_y, p_to + 1))
     and ((driving(p_world, p_uid)).id is not null or (mount_of(p_world, p_uid)).id is not null) then
    return spiral_foot_said();
  end if;
  if v_same and p_from >= 0 and p_to >= 0 and not spiral_lift_ok(p_world, v_x, v_y, p_from, p_to) then return ''; end if;
  return null;
end $$;

/*
 * Why a flight goes in here over or under one of the other sort on the same tile, or null (`stackedFlightReason`,
 * `spiralStackReason`): on the ground floor, one way off it a tile (`cellar_stack_refusal`) but for a spiral on a
 * spiral; from storey 2 up, a spiral staircase on a spiral and under one, and on nothing else, nor anything on it.
 */
create or replace function spiral_stack_refusal(p_world uuid, p_level int, p_x int, p_y int, p_spiral boolean)
  returns text language plpgsql stable as $$
declare v_other floor_tile; v_at int; v_where text;
begin
  if p_level in (0, 1) then
    select * into v_other from floor_tile f
     where f.world_id = p_world and f.level = 1 - p_level and f.x = p_x and f.y = p_y and f.kind in ('stairs', 'ladder');
    if v_other.world_id is not null and not (p_spiral and v_other.kind = 'stairs' and v_other.hand = 's') then
      return cellar_stack_refusal(p_world, p_level, p_x, p_y);
    end if;
  end if;
  if p_level < 1 then return null; end if;
  foreach v_at in array array[p_level - 1, p_level + 1] loop
    continue when v_at < 1;
    v_where := case when v_at < p_level then 'below' else 'above' end;
    select * into v_other from floor_tile f
     where f.world_id = p_world and f.level = v_at and f.x = p_x and f.y = p_y and f.kind in ('stairs', 'ladder');
    continue when v_other.world_id is null or (v_other.kind = 'stairs' and v_other.hand is not distinct from 's') = p_spiral;
    return upper(left(floor_name(v_other.kind, v_other.hand), 1)) || substr(floor_name(v_other.kind, v_other.hand), 2)
      || ' ' || v_where || ': spirals stack on spirals only.';
  end loop;
  return null;
end $$;

/* A flight down to the cellar: a spiral one comes down on its own tile, which is dug, and has no side or foot to ask for. */
do $do$
declare v_def text; v_n int; v_old text;
begin
  v_def := pg_get_functiondef('cellar_flight_refusal(uuid, integer, integer, integer, text, boolean)'::regprocedure);
  v_old := 'p_side text, p_down boolean)';
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'cellar_flight_refusal has % of its signature, not 1', v_n; end if;
  v_def := replace(v_def, v_old, 'p_side text, p_down boolean, p_spiral boolean DEFAULT false)');
  v_old := $$  if p_side is null then return 'Choose the side to climb from.'; end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'cellar_flight_refusal has % of the side asked, not 1', v_n; end if;
  v_def := replace(v_def, v_old, $$  -- A spiral staircase comes down on its own tile, which is dug.
  if p_spiral then return null; end if;
$$ || v_old);
  drop function cellar_flight_refusal(uuid, integer, integer, integer, text, boolean);
  execute v_def;
end $do$;

/* The outside staircase: a spiral one has no side it is climbed from, and its head meets the floor across any side shared with the building (`spiralBase`). */
do $do$
declare v_def text; v_n int; v_old text; v_new text;
begin
  v_def := pg_get_functiondef('frame_outside_stair_refusal(uuid, uuid, building, integer, integer, text, integer)'::regprocedure);
  v_old := 'p_side text, p_level integer)';
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'frame_outside_stair_refusal has % of its signature, not 1', v_n; end if;
  v_def := replace(v_def, v_old, 'p_side text, p_level integer, p_spiral boolean DEFAULT false)');
  v_old := $$  if p_side is null or p_side not in ('n', 'e', 's', 'w') then return 'Choose the side to climb from.'; end if;
  -- Its head, across the side away from the one it is climbed from, against the building.
  select a.x, a.y into v_hx, v_hy
    from across(p_x, p_y, case p_side when 'n' then 's' when 's' then 'n' when 'e' then 'w' else 'e' end) a;$$;
  v_new := $$  if p_spiral then
    -- A spiral one: the first footprint tile beside it, going round from the north (`spiralBase`).
    select p_x + d.dx, p_y + d.dy into v_hx, v_hy from (values (1, 0, -1), (2, 1, 0), (3, 0, 1), (4, -1, 0)) d(k, dx, dy)
     where building_at(p_world, p_x + d.dx, p_y + d.dy) is not distinct from p_b.id order by d.k limit 1;
  else
    if p_side is null or p_side not in ('n', 'e', 's', 'w') then return 'Choose the side to climb from.'; end if;
    -- Its head, across the side away from the one it is climbed from, against the building.
    select a.x, a.y into v_hx, v_hy
      from across(p_x, p_y, case p_side when 'n' then 's' when 's' then 'n' when 'e' then 'w' else 'e' end) a;
  end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'frame_outside_stair_refusal has % of the head, not 1', v_n; end if;
  v_def := replace(v_def, v_old, v_new);
  drop function frame_outside_stair_refusal(uuid, uuid, building, integer, integer, text, integer);
  execute v_def;

  v_def := pg_get_functiondef('frame_refusal'::regproc);
  v_old := $$return frame_outside_stair_refusal(p_world, p_uid, p_b, tx, ty, side, frame_floor_level(p_world, p_b.id, kind, p_target));$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'frame_refusal has % of the outside staircase, not 1', v_n; end if;
  execute replace(v_def, v_old, $$return frame_outside_stair_refusal(p_world, p_uid, p_b, tx, ty, side, frame_floor_level(p_world, p_b.id, kind, p_target),
        coalesce(stair_hand(p_target, kind) = 's', false));$$);
end $do$;

/* Planned: no side asked of a spiral staircase, and it stacks on a spiral (`spiral_stack_refusal`). */
do $do$
declare r record; v_def text; v_n int;
begin
  v_def := pg_get_functiondef('build_refusal'::regproc);
  for r in select * from (values
    (1, $$        v_gap := cellar_flight_refusal(p_world, b.id, tx, ty, side, coalesce((p_target->>'down')::boolean, false));$$,
        $$        v_gap := cellar_flight_refusal(p_world, b.id, tx, ty, side, coalesce((p_target->>'down')::boolean, false),
                                       coalesce(stair_hand(p_target, kind) = 's', false));$$),
    (2, $$      if side is null then return 'Choose the side to climb from.'; end if;$$,
        $$      -- A spiral staircase is stepped on across any side, and has none to choose.
      if side is null and stair_hand(p_target, kind) is distinct from 's' then return 'Choose the side to climb from.'; end if;$$),
    (3, $$      v_gap := cellar_stack_refusal(p_world, lvl, tx, ty); -- cellar$$,
        $$      v_gap := spiral_stack_refusal(p_world, lvl, tx, ty, coalesce(stair_hand(p_target, kind) = 's', false)); -- cellar$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'build_refusal has % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

/* Kept with no side it is climbed from. */
do $do$
declare v_def text; v_n int; v_old text;
begin
  v_def := pg_get_functiondef('perform_building'::regproc);
  v_old := $$            case when kind in ('stairs', 'ladder') then side end, stair_hand(p_target, kind), bill, bill, p_uid);$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_building has % of the facing, not 1', v_n; end if;
  execute replace(v_def, v_old, $$            case when kind in ('stairs', 'ladder') and stair_hand(p_target, kind) is distinct from 's' then side end,
            stair_hand(p_target, kind), bill, bill, p_uid);$$);
end $do$;

/* Examine of an outside spiral staircase (`frameSays`). */
do $do$
declare v_def text; v_n int; v_old text;
begin
  v_def := pg_get_functiondef('frame_says'::regproc);
  v_old := $$        v_out := v_out || case when bill_done(v_f.needed)
          then ' Outside staircase: up to ' || j.name || ' storey ' || (v_f.level + 1)
            || ', climbed from the ' || side_name(coalesce(v_f.facing, 's')) || '.'
          else ' Outside staircase planned: up to ' || j.name || ' storey ' || (v_f.level + 1) || '.' end;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'frame_says has % of the outside staircase, not 1', v_n; end if;
  execute replace(v_def, v_old, $$        -- A spiral one is climbed from any side.
        v_out := v_out || case when bill_done(v_f.needed) and v_f.hand = 's'
          then ' Outside spiral staircase: up to ' || j.name || ' storey ' || (v_f.level + 1) || ', climbed from any side.'
          when bill_done(v_f.needed)
          then ' Outside staircase: up to ' || j.name || ' storey ' || (v_f.level + 1)
            || ', climbed from the ' || side_name(coalesce(v_f.facing, 's')) || '.'
          else ' Outside ' || case when v_f.hand = 's' then 'spiral staircase' else 'staircase' end
            || ' planned: up to ' || j.name || ' storey ' || (v_f.level + 1) || '.' end;$$);
end $do$;

/* What stands over a cellar tile or lands on it: a spiral staircase down lands on its own tile only (`flightOnto`). */
do $do$
declare v_def text; v_n int; v_old text;
begin
  v_def := pg_get_functiondef('cellar_flight_onto'::regproc);
  v_old := $$          or (f.x, f.y, coalesce(f.facing, 's')) in ((p_x, p_y + 1, 'n'), (p_x - 1, p_y, 'e'), (p_x, p_y - 1, 's'), (p_x + 1, p_y, 'w')))$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'cellar_flight_onto has % of the foot, not 1', v_n; end if;
  execute replace(v_def, v_old, $$          or (f.hand is distinct from 's'
              and (f.x, f.y, coalesce(f.facing, 's')) in ((p_x, p_y + 1, 'n'), (p_x - 1, p_y, 'e'), (p_x, p_y - 1, 's'), (p_x + 1, p_y, 'w'))))$$);
end $do$;

/* Down and up a spiral staircase to the cellar: on its own tile, its foot under its head. */
do $do$
declare r record; v_def text; v_n int;
begin
  v_def := pg_get_functiondef('cellar_move_ok'::regproc);
  for r in select * from (values
    (1, $$    return f.world_id is not null and f.building = c.building and (v_x, v_y) = cellar_foot(v_fx, v_fy, f.facing);$$,
        $$    return f.world_id is not null and f.building = c.building
       and case when f.hand = 's' then (v_x, v_y) = (v_fx, v_fy) else (v_x, v_y) = cellar_foot(v_fx, v_fy, f.facing) end;$$),
    (2, $$  return p_to = 0 and f.world_id is not null and (v_fx, v_fy) = cellar_foot(v_x, v_y, f.facing);$$,
        $$  return p_to = 0 and f.world_id is not null
     and case when f.hand = 's' then (v_fx, v_fy) = (v_x, v_y) else (v_fx, v_fy) = cellar_foot(v_x, v_y, f.facing) end;$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'cellar_move_ok has % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

/* And `rpc_move` holds a body to them (`spiral_move_refusal`), on the word as it was asked. */
do $do$
declare r record; v_def text; v_n int;
begin
  v_def := pg_get_functiondef('rpc_move(uuid, double precision, double precision, integer, jsonb)'::regprocedure);
  for r in select * from (values
    (1, $$declare me uuid := auth.uid(); p player; w world;$$,
        $$declare me uuid := auth.uid(); p player; w world; v_asked double precision[]; v_spiral text;$$),
    (2, $$  if p_x < 0 or p_y < 0 or p_x > w.size or p_y > w.size then raise exception 'that is off the island'; end if;$$,
        $$  if p_x < 0 or p_y < 0 or p_x > w.size or p_y > w.size then raise exception 'that is off the island'; end if;
  -- The word as it was asked: a spiral staircase's rules are asked of it, not of what is left of it held back (`spiral_move_refusal`).
  v_asked := array[p_x, p_y, p_level];$$),
    (3, $$  if (p_level < 0 or p.level < 0) and not cellar_move_ok(p_world, me, p.level, p_level, p.x, p.y, p_x, p_y) then
    p_x := p.x; p_y := p.y; p_level := p.level; blocked := true;
  end if;$$,
        $$  if (p_level < 0 or p.level < 0) and not cellar_move_ok(p_world, me, p.level, p_level, p.x, p.y, p_x, p_y) then
    p_x := p.x; p_y := p.y; p_level := p.level; blocked := true;
  end if;
  -- A spiral staircase: on foot only, and a storey up or down on one tile only up or down one (`spiral_move_refusal`).
  if v_asked is not null then
    v_spiral := spiral_move_refusal(p_world, me, p.level, v_asked[3]::int, p.x, p.y, v_asked[1], v_asked[2]);
    if v_spiral is not null then
      p_x := p.x; p_y := p.y; p_level := p.level; blocked := true;
      if v_spiral <> '' then perform tell(p_world, me, v_spiral, 'error'); end if;
    end if;
  end if;$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'rpc_move has % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

select private.lock_doors();
