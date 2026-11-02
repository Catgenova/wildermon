-- Asked: "when forming a new settlement, it must be at least far enough away that the border between that settlement
-- at maximum size and other nearby settlements at max size would be 5 tiles apart". A token goes in only where every
-- other settlement's token is `deed_spacing()` tiles off on one axis or the other: twice the border at the last level
-- (`deed_radius(max_deed_level())`), the token's own tile, and `deed_gap()` tiles between the two borders. The
-- browser's `DEED_GAP` and `DEED_SPACING` (`game.ts`).
create or replace function public.deed_gap() returns integer language sql immutable as $$ select 5 $$;
create or replace function public.deed_spacing() returns integer language sql stable as $$
  select 2 * deed_radius(max_deed_level()) + 1 + deed_gap()
$$;

create or replace function public.deed_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
returns text language plpgsql stable as $fn$
declare p player; tx int; ty int; want int := 5; other deed; v_apart int := deed_spacing();
begin
  select * into p from player where world_id = p_world and uid = p_uid;
  tx := floor(p.x)::int; ty := floor(p.y)::int;
  if exists (select 1 from deed d where d.world_id = p_world and d.founded_by = p_uid) then
    return 'Already founded a settlement. Disband it first.';
  end if;
  if pack_count(p_world, p_uid, 'deed_stake') <= 0 then return 'You have no ' || (select lower(d.name) from item_def d where d.id = 'deed_stake') || '.'; end if;
  if tx - want < 0 or ty - want < 0
     or not in_bounds(p_world, tx + want, ty + want) then
    return 'Too close to the map edge.';
  end if;
  -- A poured slab is dry, level ground standing above whatever is under it,
  -- which is what a token wants and is sometimes the only such tile about.
  if slab_at(p_world, tx, ty) is null then
    if has_water(p_world, tx, ty) then return 'Totem needs dry land.'; end if;
    if not passable(p_world, tx, ty) then return 'Totem needs a clear tile.'; end if;
  end if;
  -- The nearest token closer than the spacing on both axes, by the larger of the two distances.
  select * into other from deed d
   where d.world_id = p_world
     and abs(tx - d.x) < v_apart
     and abs(ty - d.y) < v_apart
   order by greatest(abs(tx - d.x), abs(ty - d.y)), d.founded_at limit 1;
  if found then
    return 'Too close to ' || other.name || ': ' || greatest(abs(tx - other.x), abs(ty - other.y))
        || ' tiles token to token; ' || v_apart || ' needed (borders at level ' || max_deed_level()
        || ' ' || deed_gap() || ' tiles apart).';
  end if;
  return null;
end $fn$;

select private.lock_doors();
