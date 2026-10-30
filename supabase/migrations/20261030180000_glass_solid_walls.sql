-- Glass is laid as a solid wall as well as a pitched roof.
--
-- Asked: "render the walls to be a thick transparent glass with timber top and bottom borders", glass under Solid when
-- a wall is planned. So:
--
--   * `build_material_def` gives glass an `only` as stained glass has one (the definitions migration after this one):
--     `only_walls` solid, `only_floors` roof, and `only_said` "Glass: only as a solid wall or a roof." Its bill is the
--     one it had, a solid wall's, which a roof shape already took its share of.
--   * `glass_refusal` asks `material_only_refusal` of glass as of every material with an `only`, for a wall, a fence
--     and a floor slot alike, where it said "Glass: roofs only." for all of them. A pitched roof only, a flat one being
--     a deck, is asked after it as before.
--   * `frame_refusal` asks it of a column the same way, where it said "Glass: roofs only." first.
--   * `glass_roof_only_said` goes; nothing calls it.
--
-- `walled_round` already counts any finished wall of full height, so a glasshouse may be walled in glass. The browser's
-- `glassPlanRefusal` and `onlyRefusal` (`src/game/glasshouse.ts`, `building.ts`) say the same words;
-- `supabase/test/glasswall.ts` holds the two sides to them.

set local lock_timeout = '3s';

create or replace function glass_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $function$
declare tx int := (p_target->>'x')::int; ty int := (p_target->>'y')::int;
        v_mat text := coalesce(p_target->>'material', ''); v_kind text := coalesce(p_target->>'floorKind', 'floor');
        b building;
begin
  if p_action = 'add_floor' then
    select * into b from building where world_id = p_world and id = building_at(p_world, tx, ty);
    return case when b.id is not null and field_in(p_world, b.id) then field_no_storey_said() end;
  end if;
  if p_action in ('plan_wall', 'plan_fence') then
    if coalesce(p_target->>'side', '') = '' or coalesce(p_target->>'wallType', '') = '' or v_mat = '' then return null; end if;
    -- A material with an `only` as that and nothing else (`material_only_refusal`): glass as a solid wall or a roof.
    return material_only_refusal(v_mat, p_target->>'wallType', null);
  end if;
  if p_action <> 'plan_floor' or v_mat = '' then return null; end if;
  if material_only_refusal(v_mat, null, v_kind) is not null then return material_only_refusal(v_mat, null, v_kind); end if;
  select * into b from building where world_id = p_world and id = building_at(p_world, tx, ty);
  if b.id is null then return null; end if;
  -- A building has one roof, and its first tile set the shape; the first tile asks for its own.
  if v_mat = glass_material()
     and coalesce(b.roof, (select r.id from roof_shape_def r where r.id = p_target->>'roofShape'), 'hip') = 'flat' then
    return glass_pitched_said();
  end if;
  if v_kind = 'floor' and work_level(p_world, b.id) = 0 and land_tile(p_world, tx, ty) = tile_id('Field') then
    return field_unfloored_said();
  end if;
  if v_kind = 'roof' and v_mat <> glass_material() and field_in(p_world, b.id) then
    return field_glass_only_said();
  end if;
  return null;
end $function$;

do $do$
declare v text; v_n int;
  v_old text := $o$    -- Glass goes on a roof and nowhere else (`glass_refusal`).
    if mat.id = glass_material() then return glass_roof_only_said(); end if;
    -- And no material with an `only` makes a column.
$o$;
begin
  v := pg_get_functiondef('public.frame_refusal'::regproc);
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'frame_refusal has % of the glass column line, not 1', v_n; end if;
  execute replace(v, v_old, $n$    -- No material with an `only` makes a column: glass and stained glass among them.
$n$);
end $do$;

drop function if exists glass_roof_only_said();

select private.lock_doors();
