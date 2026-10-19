-- The dragon stands up on Volcano Isle and nowhere else; and a wildermon still called what its kind used to be called
-- is called what its kind is now.
--
-- Asked for: "a dragon spawned on the crescent island, theyre only supposed to spawn on the northernmost island", the
-- northernmost being Volcano Isle. `pick_monster` took any monster with room under its cap wherever it was asked; it
-- now passes over one kept to another island (`monster_isle`, in the defs: the browser's `Region.lair`). And a grand
-- map's hoard is guarded by a dragon, stood up where the hoard is dug: a hoard whose guard keeps to one island is
-- buried on that island, round its middle (`treasure_spot_for`, the browser's `hoardSpot`), and one buried elsewhere
-- before now moves there the next time its map is asked where it points (`treasure_at`), as one under a new deed does.
--
-- And: "Wildermon with the new names and models are still retaining the old names when tamed". A wild one is given its
-- kind's name when it stands up, as its own, and keeps it when tamed; the ones that stood up before their kind was
-- renamed were still a Rabba or a Bevere. Those are called what their kind is now (`species_def`), and only those: a
-- name somebody gave is never one of these.

set local lock_timeout = '3s';

do $do$
declare v_def text;
  v_old text := $$  select w.species into got from wild_table w
  where w.monster and (select count(*) from creature c$$;
  v_new text := $$  -- And one kept to an island only on that island (`monster_isle`).
  select w.species into got from wild_table w
  where w.monster and (monster_isle(w.species) is null or monster_isle(w.species) = v_r) and (select count(*) from creature c$$;
begin
  select pg_get_functiondef('public.pick_monster'::regproc) into v_def;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'pick_monster does not take its monster where it was expected to';
  end if;
  execute replace(v_def, v_old, v_new);
end $do$;

-- Somewhere to bury a hoard guarded by this, from (p_x, p_y): on the guard's own island when it keeps to one.
create or replace function treasure_spot_for(p_world uuid, p_x double precision, p_y double precision, p_guard text)
  returns table (x int, y int) language plpgsql as $fn$
declare v_size int; v_isle int := monster_isle(p_guard); v_mid double precision[]; v_x int; v_y int; v_try int;
        v_a double precision; v_r double precision;
begin
  if v_isle is null then
    return query select * from treasure_spot(p_world, p_x, p_y);
    return;
  end if;
  select w.size into v_size from world w where w.id = p_world;
  v_mid := region_middle(v_isle);
  for v_try in 1..200 loop
    v_a := random() * 2 * pi();
    v_r := least(map_range(), greatest(4, v_size / 3.0)) * sqrt(random());
    v_x := floor(v_mid[1] * v_size + cos(v_a) * v_r)::int;
    v_y := floor(v_mid[2] * v_size + sin(v_a) * v_r)::int;
    continue when v_x < 1 or v_y < 1 or v_x >= v_size - 1 or v_y >= v_size - 1;
    continue when region_at(p_world, v_x + 0.5, v_y + 0.5) is distinct from v_isle;
    continue when not creature_tile_ok(p_world, v_x, v_y);
    continue when coalesce(centre_height(p_world, v_x, v_y), -1) < 4;
    continue when exists (select 1 from deed_covering(p_world, v_x, v_y));
    x := v_x; y := v_y;
    return next;
    return;
  end loop;
end $fn$;

-- Where a map points, now: off a deed gone in over it, as before, and onto its guard's island when it is not on it.
create or replace function treasure_at(p_item bigint) returns treasure language plpgsql as $fn$
declare v_t treasure; v_spot record; v_guard text; v_isle int;
begin
  select * into v_t from treasure where item_id = p_item;
  if not found then return null; end if;
  select d.guard into v_guard from treasure_def d where d.id = v_t.tier;
  v_isle := monster_isle(v_guard);
  if not exists (select 1 from deed_covering(v_t.world_id, v_t.x, v_t.y))
     and (v_isle is null or region_at(v_t.world_id, v_t.x + 0.5, v_t.y + 0.5) is not distinct from v_isle) then
    return v_t;
  end if;
  select * into v_spot from treasure_spot_for(v_t.world_id, v_t.x, v_t.y, v_guard);
  if v_spot.x is null then return v_t; end if;
  update treasure set x = v_spot.x, y = v_spot.y where item_id = p_item returning * into v_t;
  return v_t;
end $fn$;

do $do$
declare v_def text; v_old text := 'select * into v_spot from treasure_spot(p_world, p_x, p_y);';
begin
  select pg_get_functiondef('public.bury_treasure'::regproc) into v_def;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'bury_treasure does not find its spot where it was expected to';
  end if;
  execute replace(v_def, v_old, 'select * into v_spot from treasure_spot_for(p_world, p_x, p_y, (treasure_tier(p_ql)).guard);');
end $do$;

update creature c set name = d.name
  from species_def d, (values ('rabba', 'Rabba'), ('vola', 'Vola'), ('woola', 'Woola'), ('seavic', 'Seavic'), ('warda', 'Warda'),
                              ('noot', 'Noot'), ('crawler', 'Crawler'), ('mola', 'Mola'), ('quarra', 'Quarra'),
                              ('bevere', 'Bevere'), ('embra', 'Embra')) was(species, name)
 where d.id = c.species and was.species = c.species and c.name = was.name and d.name <> was.name;

select private.lock_doors();
