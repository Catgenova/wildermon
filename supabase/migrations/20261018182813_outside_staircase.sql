-- An outside staircase: "Allow building a staircase adjacent to a building to allow stairs going directly to the floor
-- above from outside a building".
--
-- A staircase, wide or single, planned on storey 2's floor slot (`outside_stair_level`) of a tile of open ground just
-- out past a building's footprint, its head against the building and its foot out on the ground. It is a floor tile of
-- that storey as every flight is, billed, built and taken out as one, and walked as one: up onto it from the ground,
-- through a doorway of storey 2 off its head, and down off its sides (`frame_footing` asks nothing more). It is no
-- part of the storey (`frame_storey_shut`): no walls are asked round it, no roof goes over it, and no wall carries it
-- (`frame_bears_jetty`). Nothing else is planned on its tile while it stands (`frame_jetty_over`). A ladder still goes
-- inside the footprint. The browser's `outsideStairReason` says every refusal here, word for word.

-- The storey it climbs to, which the definitions that come in after this carry as well.
create or replace function outside_stair_level() returns double precision language sql immutable as $fn$ select 1::double precision $fn$;

-- What stands over a tile, or on it: a jetty of a building, or its outside staircase (`jettyOver`).
create or replace function frame_jetty_over(p_world uuid, p_x integer, p_y integer) returns text
language sql stable as $fn$
  select case when exists (select 1 from floor_tile f
                            where f.world_id = p_world and f.level = outside_stair_level()::int
                              and f.x = p_x and f.y = p_y and f.kind = 'stairs')
              then b.name || '''s outside staircase stands on that tile.'
              else 'That tile is under ' || b.name || '''s jetty.' end
    from building b
   where b.world_id = p_world and b.id = frame_jetty_of(p_world, p_x, p_y)
$fn$;

-- Why an outside staircase may not be planned on a tile out past a building's footprint, or null (`outsideStairReason`).
create or replace function frame_outside_stair_refusal(p_world uuid, p_uid uuid, p_b building, p_x integer, p_y integer,
                                                       p_side text, p_level integer) returns text
language plpgsql stable as $fn$
declare v_storey int := outside_stair_level()::int + 1; v_kind text; v_hx int; v_hy int;
        v_below double precision; v_high int;
begin
  if p_b.levels <= outside_stair_level()::int then
    return 'An outside staircase climbs from the ground to storey ' || v_storey || ': plan storey ' || v_storey
        || ' of ' || p_b.name || ' first.';
  end if;
  if p_level <> outside_stair_level()::int then
    return 'An outside staircase climbs from the ground to storey ' || v_storey || ': work on storey ' || v_storey
        || ' to plan one.';
  end if;
  -- Nothing of any building's over it or on it already, at any storey; one of its own on this storey is "already planned".
  if frame_jetty_of(p_world, p_x, p_y) is not null
     and (frame_jetty_of(p_world, p_x, p_y) <> p_b.id
          or not exists (select 1 from floor_tile f where f.world_id = p_world and f.level = p_level
                           and f.x = p_x and f.y = p_y)) then
    return frame_jetty_over(p_world, p_x, p_y);
  end if;
  if not on_my_deed(p_world, p_uid, p_x, p_y) then return 'You may only build on your own deed.'; end if;
  -- No span of a bridge or an aqueduct goes over it, nor a drawbridge's winch, as for a jetty.
  select b.kind into v_kind from bridge_span s join bridge b on b.world_id = s.world_id and b.id = s.bridge
   where s.world_id = p_world and s.x = p_x and s.y = p_y limit 1;
  if v_kind is not null then
    return case when v_kind = 'aqueduct' then 'An aqueduct is carried over that tile.' else 'A bridge crosses that tile.' end;
  end if;
  if drawbridge_winch_at(p_world, p_x, p_y) then
    return 'A drawbridge''s winch stands on that tile, and its gallows rise over it.';
  end if;
  if not passable(p_world, p_x, p_y) or land_tile(p_world, p_x, p_y) = tile_id('Bush') then
    return 'An outside staircase stands on open ground: clear the tree or the bush from it first.';
  end if;
  if has_water(p_world, p_x, p_y) then return 'An outside staircase stands on dry ground, not in water.'; end if;
  if p_side is null or p_side not in ('n', 'e', 's', 'w') then return 'Choose the side to climb from.'; end if;
  -- Its head, across the side away from the one it is climbed from, against the building.
  select a.x, a.y into v_hx, v_hy
    from across(p_x, p_y, case p_side when 'n' then 's' when 's' then 'n' when 'e' then 'w' else 'e' end) a;
  if building_at(p_world, v_hx, v_hy) is distinct from p_b.id then
    return 'Its head goes against ' || p_b.name || ' and its foot out on the ground: turn it to climb toward the building.';
  end if;
  -- Never lower over the ground than the floor its head is level with the bottom of: on piers, the building's deck.
  v_below := coalesce(p_b.deck, land_height(p_world, v_hx, v_hy)) + (p_level - 1) * wall_height();
  v_high := greatest(land_height(p_world, p_x, p_y), land_height(p_world, p_x + 1, p_y),
                     land_height(p_world, p_x + 1, p_y + 1), land_height(p_world, p_x, p_y + 1));
  if v_high > v_below then
    return 'The ground under it rises above the floor of storey ' || p_level || ': dig it down first.';
  end if;
  return null;
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A ladder still goes inside the footprint; a staircase out past it is an outside staircase (below).
    (1, 'frame_jetty_refusal',
     $$  if p_kind in ('stairs', 'ladder') then return 'Stairs and ladders go inside the footprint, not out on a jetty.'; end if;$$,
     $$  if p_kind = 'ladder' then return 'A ladder goes inside the footprint, not out on a jetty.'; end if;$$, 1),
    (2, 'frame_jetty_refusal',
     $$if over.id is not null and over.id <> p_b.id then return 'That tile is under ' || over.name || '''s jetty.'; end if;$$,
     $$if over.id is not null and over.id <> p_b.id then return frame_jetty_over(p_world, p_x, p_y); end if;$$, 1),
    (3, 'frame_refusal',
     $$if over.id is not null then return 'That tile is under ' || over.name || '''s jetty.'; end if;$$,
     $$if over.id is not null then return frame_jetty_over(p_world, tx, ty); end if;$$, 1),
    (4, 'frame_refusal',
     $$    return frame_jetty_refusal($$,
     $$    -- An outside staircase, up from the ground out past the footprint (`frame_outside_stair_refusal`).
    if kind = 'stairs' then
      return frame_outside_stair_refusal(p_world, p_uid, p_b, tx, ty, side, frame_floor_level(p_world, p_b.id, kind, p_target));
    end if;
    return frame_jetty_refusal($$, 1),
    -- An outside staircase is no part of the storey it climbs to.
    (5, 'frame_storey_shut',
     $$                      and f.building = p_building)$$,
     $$                      and f.building = p_building and f.kind <> 'stairs')$$, 1),
    -- Nor does a wall carry it: it stands on the ground.
    (6, 'frame_bears_jetty',
     $$and ft.x = v_j.jx and ft.y = v_j.jy and ft.building = p_wall.building) then continue;$$,
     $$and ft.x = v_j.jx and ft.y = v_j.jy and ft.building = p_wall.building
                     and ft.kind <> 'stairs') then continue;$$, 1),
    -- What Examine says of it (`frameSays`).
    (7, 'frame_says',
     $$      if not bill_done(v_f.needed) then
        v_out := v_out || ' A jetty of '$$,
     $$      if v_f.kind = 'stairs' then
        v_out := v_out || case when bill_done(v_f.needed)
          then ' On it is an outside staircase up to ' || j.name || '''s storey ' || (v_f.level + 1)
            || ', climbed from the ' || side_name(coalesce(v_f.facing, 's')) || '.'
          else ' An outside staircase up to ' || j.name || '''s storey ' || (v_f.level + 1) || ' is planned on it.' end;
      elsif not bill_done(v_f.needed) then
        v_out := v_out || ' A jetty of '$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
