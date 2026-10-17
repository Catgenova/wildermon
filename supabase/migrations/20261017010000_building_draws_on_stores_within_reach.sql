-- Building draws on the stores within reach.
--
-- Asked for: "building a wall or other building actions should also be able
-- to draw materials from wagon or nearby storage within 3 tiles".
--
-- A wall, a floor or a frame took what it lays from the pack, then a crate on
-- the tile, then -- for a Mason's Hod Carrier, on stone -- the stores within
-- the perk's reach (`hod_stock`, by `build_reach`). Everybody now reaches the
-- stores a craft takes from (`CRAFT_REACH`, 3 tiles) while the player's
-- craft_from_stores is on, as `buildReach` does in the browser; a Hod Carrier
-- still reaches further on stone, and with it off too.
--
-- A bridge's or an aqueduct's span took its stuff from the pack alone. It now
-- takes it as a wall does (`take_material`, `build_to_hand`) with no material:
-- the pack, a crate on the span's tile, the stores within reach. Their
-- refusal says "you have no X to hand" in place of "you are carrying no X",
-- as the browser does.

create or replace function public.build_reach(p_world uuid, p_uid uuid, p_material text)
 returns double precision
 language sql
 stable
as $function$
  -- As far as a craft reaches (CRAFT_REACH) with stores on, or a perk's reach for the material's work, whichever is further.
  select greatest(
    coalesce(pk(p_world, p_uid, 'reach:' || build_work((select m.kind from build_material_def m where m.id = p_material)), 0), 0),
    case when coalesce((select p.craft_from_stores from player p where p.world_id = p_world and p.uid = p_uid), true) then 3 else 0 end)
$function$;

do $do$
declare r record; v_def text; v_n int; v_fn text := '';
begin
  for r in select * from (values
    -- A bridge's span: what to fit next, and taking it.
    ('perform_last', $$      where (e2.value)::int > 0 and pack_count(p_world, p_uid, e2.key) > 0 order by e2.key limit 1;
    if v_want is null then return; end if;
    if not consume(p_world, p_uid, v_want, 1) then return; end if;
$$, $$      where (e2.value)::int > 0 and build_to_hand(p_world, p_uid, e2.key, s.x, s.y, null) > 0 order by e2.key limit 1;
    if v_want is null then return; end if;
    -- Out of the pack, a crate on the span or the stores within reach, as a wall's is.
    if not take_material(p_world, p_uid, v_want, s.x, s.y, null) then return; end if;
$$),
    ('last_refusal', $$        where (e.value)::int > 0 and pack_count(p_world, p_uid, e.key) < 1 order by e.key limit 1;
      if v_short is not null then
        return 'That span wants ' || span_wants(s.needed) || '; you are carrying no '
          || lower((select coalesce(name, v_short) from item_def where id = v_short)) || '.';
$$, $$        where (e.value)::int > 0 and build_to_hand(p_world, p_uid, e.key, s.x, s.y, null) < 1 order by e.key limit 1;
      if v_short is not null then
        return 'That span wants ' || span_wants(s.needed) || '; you have no '
          || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';
$$),
    -- An aqueduct's span, the same.
    ('perform_aqueduct', $$      where (e2.value)::int > 0 and pack_count(p_world, p_uid, e2.key) > 0 order by e2.key limit 1;
    if v_want is null then return; end if;
    if not consume(p_world, p_uid, v_want, 1) then return; end if;
$$, $$      where (e2.value)::int > 0 and build_to_hand(p_world, p_uid, e2.key, s.x, s.y, null) > 0 order by e2.key limit 1;
    if v_want is null then return; end if;
    -- Out of the pack, a crate on the span or the stores within reach, as a wall's is.
    if not take_material(p_world, p_uid, v_want, s.x, s.y, null) then return; end if;
$$),
    ('aqueduct_refusal', $$      where (e.value)::int > 0 and pack_count(p_world, p_uid, e.key) < 1 order by e.key limit 1;
    if v_short is not null then
      return 'That span wants ' || span_wants(s.needed) || '; you are carrying no '
        || lower((select coalesce(name, v_short) from item_def where id = v_short)) || '.';
$$, $$      where (e.value)::int > 0 and build_to_hand(p_world, p_uid, e.key, s.x, s.y, null) < 1 order by e.key limit 1;
    if v_short is not null then
      return 'That span wants ' || span_wants(s.needed) || '; you have no '
        || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';
$$)
  ) as t(fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of the line to change, not 1', r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
