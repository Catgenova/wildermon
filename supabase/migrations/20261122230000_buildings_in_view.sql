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


-- And it is read as a look, as the land is (`rpc_land_window`): paced as a look, and no more than one at a time is not
-- asked of a read (`pace_class`, which `lock_doors` guards every door by).
create or replace function private.pace_class(p_door text)
 returns text
 language sql
 immutable
as $function$
  select case
    when p_door = 'rpc_move' then 'move'
    when p_door in ('rpc_barter', 'rpc_boards', 'rpc_built_window', 'rpc_chat', 'rpc_classes', 'rpc_clock', 'rpc_creatures', 'rpc_deals',
                    'rpc_faith', 'rpc_fog', 'rpc_ground', 'rpc_guide', 'rpc_guide_seen', 'rpc_join', 'rpc_land_window',
                    'rpc_letters', 'rpc_market', 'rpc_my_look', 'rpc_my_name', 'rpc_name_free', 'rpc_notices_ashore',
                    'rpc_orders', 'rpc_owner_am_i', 'rpc_owner_online', 'rpc_parcels', 'rpc_prices', 'rpc_sales',
                    'rpc_rune_gate_folk', 'rpc_settle', 'rpc_settlement', 'rpc_social', 'rpc_spells', 'rpc_springs',
                    'rpc_store_log', 'rpc_swirls', 'rpc_treasure_map', 'rpc_treasure_warm', 'rpc_tree',
                    'rpc_unported', 'rpc_worn') then 'look'
    when p_door in ('rpc_abandon', 'rpc_barter_accept', 'rpc_barter_answer', 'rpc_barter_ask', 'rpc_barter_cancel',
                    'rpc_barter_offer', 'rpc_buy', 'rpc_collect', 'rpc_deal', 'rpc_deal_answer', 'rpc_found',
                    'rpc_friend', 'rpc_unfriend', 'rpc_invite', 'rpc_invite_answer', 'rpc_join_answer', 'rpc_join_ask',
                    'rpc_join_withdraw', 'rpc_leave_deed', 'rpc_letter', 'rpc_parcel', 'rpc_notice_post',
                    'rpc_notice_drop', 'rpc_order', 'rpc_order_cancel', 'rpc_order_fill', 'rpc_price', 'rpc_takings',
                    'rpc_say', 'rpc_report_error') then 'deal'
    when p_door in ('rpc_put_land', 'rpc_ready') then 'land'
    else 'act' end
$function$;
select private.lock_doors();
