-- Buildings in view: the walls, floors and buildings in a box of the island, for a client whose camera sees past the
-- ground it reads round its body (`rpc_ground`, `GROUND_RANGE` 40 tiles, at most `read_range_most` 64).
--
-- Asked for: "All walls within the camera should render on the unity version". The Unity client's camera sees a long
-- way over the land (`LAND_NEAR`, 192 tiles), and every building past 40 tiles of its body stood there without a wall.
-- This is the box the camera sees, read now and then a page at a time, as `rpc_land_window` reads the land:
--   * read only, and only for a body on the island; paced as a look, and refused when asked too quickly;
--   * clamped to the island, and no bigger than 128 tiles a side;
--   * each wall as `rpc_ground` sends it (its building, storey, place, side, material and bill), and a hidden door its
--     padlock does not admit as the solid wall it looks like (`wall_seen_type`); no gate gear, no ivy: what a wall
--     looks like from far off;
--   * each floor as `rpc_ground` sends it; each building with a tile in the box: its storeys, roof and tiles.
-- The live read round the body (`rpc_ground`) stays the truth for everything near: this only draws what lies past it.

create or replace function public.rpc_built_window(p_world uuid, p_x0 integer, p_y0 integer, p_x1 integer, p_y1 integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  v_size int;
  x0 int; y0 int; x1 int; y1 int;
begin
  perform private.pace(auth.uid(), 'look');
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select size into v_size from world where id = p_world;
  if v_size is null then raise exception 'no such island'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then
    raise exception 'you are not on this island';
  end if;

  -- Clamped rather than refused, as the land is (`rpc_land_window`): a box that runs off the island is what a camera
  -- over the shore sees.
  x0 := greatest(0, least(v_size - 1, p_x0));
  x1 := greatest(x0, least(v_size - 1, p_x1));
  y0 := greatest(0, least(v_size - 1, p_y0));
  y1 := greatest(y0, least(v_size - 1, p_y1));
  if (x1 - x0 + 1) > 128 or (y1 - y0 + 1) > 128 then
    raise exception 'ask for a smaller square of the island';
  end if;

  return jsonb_build_object(
    'x0', x0, 'y0', y0, 'x1', x1, 'y1', y1,
    'walls', coalesce((select jsonb_agg(jsonb_build_object(
          'building', w.building, 'level', w.level, 'x', w.x, 'y', w.y, 'dir', w.dir,
          'type', wall_seen_type(p_world, me, w), 'material', w.material, 'needed', w.needed, 'total', w.total)
          order by w.level, w.dir, w.x, w.y)
        from wall w
        where w.world_id = p_world and w.x between x0 and x1 and w.y between y0 and y1), '[]'::jsonb),
    'floors', coalesce((select jsonb_agg(jsonb_build_object(
          'building', f.building, 'level', f.level, 'x', f.x, 'y', f.y,
          'material', f.material, 'kind', f.kind, 'facing', f.facing, 'hand', f.hand,
          'needed', f.needed, 'total', f.total) order by f.level, f.x, f.y)
        from floor_tile f
        where f.world_id = p_world and f.x between x0 and x1 and f.y between y0 and y1), '[]'::jsonb),
    'buildings', coalesce((select jsonb_agg(jsonb_build_object(
          'id', b.id, 'levels', b.levels, 'roof', b.roof,
          'tiles', (select coalesce(jsonb_agg(bt.x || ',' || bt.y order by bt.y, bt.x), '[]'::jsonb)
                      from building_tile bt
                     where bt.world_id = p_world and bt.building = b.id)) order by b.id)
        from building b
        where b.world_id = p_world
          and b.id in (select bt.building from building_tile bt
                        where bt.world_id = p_world and bt.x between x0 and x1 and bt.y between y0 and y1)), '[]'::jsonb));
end $function$;

select private.lock_doors();
