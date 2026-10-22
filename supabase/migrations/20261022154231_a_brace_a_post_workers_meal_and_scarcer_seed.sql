-- An ancient brace; a wildermon on a work post eats from the stores in its reach; and seed one harvest in three-ish.
--
-- Asked for: "Also add an Ancient Brace that increases wildermon action speed by 1% per, up to 50 uses per wildermon, 5
-- parts. Implement that wildermon on a workpost will feed themselves eligible food from containers in work range when
-- hungry, as they would on a deed. Reduce standard seed yield when farming to 30% chance of getting 1 per harvest". The
-- relic (`old brace`, five pieces), its item and the numbers (`brace_step`, `brace_most`, `seed_chance`) are the
-- snapshot's before this. Here:
--
--   * an ancient brace used on a wildermon of yours from its menu puts a use on it (`boosts.brace`), `brace_step` more
--     action speed each (`pot_mul` on `work`), up to `brace_most` (`brace_points`), as the browser's `bracePoints`;
--   * a hungry worker on a work post eats from the containers within the post's work range (`work_site`) that its keeper
--     made, as one on a settlement eats from the containers on it (`worker_feed`);
--   * a harvest gives `crop_yield`'s one seed `seed_chance` of the time (a harvester's `seed:harvest_crop` where a perk
--     sets one) and none the rest (`harvest_seeds`), on every
--     road a harvest takes: yours, a planter's, and a worker's in the field and at a planter; a tend says so.

set local lock_timeout = '3s';

-- An ancient brace's uses on one wildermon, as many as count (`bracePoints`).
create or replace function brace_points(c creature) returns int language sql immutable as $fn$
  select greatest(0, least(brace_most()::int, floor(coalesce((c.boosts->>'brace')::double precision, 0))::int))
$fn$;

-- And on its action speed (`potMul`).
create or replace function pot_mul(c creature, p_channel text) returns double precision language sql stable as $fn$
  select case when p_channel = any(base_stats()) then 1 + pot_step() * pot_points(c, p_channel)
              when p_channel = 'appetite' and fitted(c, 'collar') then 1 - collar_cut()
              else 1 end
       * case when p_channel = 'work' then 1 + brace_step() * brace_points(c) else 1 end
$fn$;

-- The seed one harvest gives: `crop_yield`'s seed `seed_chance` of the time, and none the rest (`harvestSeeds`).
create or replace function crop_yield(p_tended integer) returns integer[] language sql immutable as $fn$
  select array[1, 1 + least(3, greatest(0, p_tended))]
$fn$;
create or replace function harvest_seeds(p_chance double precision default seed_chance()) returns integer language sql volatile as $fn$
  select case when random() < p_chance then (crop_yield(0))[1] else 0 end
$fn$;
-- As a field and a tend say it: "1 seed at 30%" (`seedSays`).
create or replace function seed_says() returns text language sql immutable as $fn$
  select (crop_yield(0))[1] || ' seed at ' || round(seed_chance() * 100)::int || '%'
$fn$;

/*
 * A hungry worker eats the plainest thing it eats out of the stores it works for: on a work post, the containers within
 * the post's work range that its keeper made; otherwise, as ever, the containers on the settlement it stands on.
 */
create or replace function worker_feed(p_world uuid, p_id integer, p_care double precision default null)
returns text language plpgsql as $fn$
declare c creature; v_deed deed; v_it item; v_site record;
begin
  select * into c from creature where world_id = p_world and id = p_id;
  if not found or c.mode = 'wild' then return null; end if;
  if c.post is not null then
    select * into v_site from work_site(p_world, c) ws where ws.post is not null;
  end if;
  if v_site.post is null then
    select * into v_deed from deed_covering(p_world, floor(creature_x(c))::int, floor(creature_y(c))::int) limit 1;
    if v_deed.world_id is null then return null; end if;
  end if;
  /*
   * Any container: what holds things and is not the trash crate. Not a locked thing, a thing with a price on it, or a
   * letter or parcel under a deal, whatever it is in.
   */
  select i.* into v_it
    from (
      select i.*
        from crate k
        join item i on i.world_id = k.world_id and i.holder = 'crate' and i.crate = k.id
       where k.world_id = p_world
         and case when v_site.post is not null
                  then abs(k.x - v_site.x) <= v_site.radius and abs(k.y - v_site.y) <= v_site.radius and k.made_by = c.keeper
                  else deed_covers(v_deed, k.x, k.y) end
      union all
      select i.*
        from placed p
        join furniture_def fd on fd.id = p.sub
        join item i on i.world_id = p.world_id and i.holder = 'furniture' and i.placed = p.id
       where p.world_id = p_world and p.kind = 'furniture'
         and coalesce(fd.capacity, 0) > 0 and coalesce(fd.trash, 0) = 0
         and case when v_site.post is not null
                  then abs(p.x - v_site.x) <= v_site.radius and abs(p.y - v_site.y) <= v_site.radius and p.made_by = c.keeper
                  else deed_covers(v_deed, p.x, p.y) end) i
   where not i.locked and i.price is null and i.letter is null and i.deal is null
     and exists (select 1 from species_diet sd where sd.species = c.species and sd.item = i.def)
   order by i.ql, i.id
   limit 1;
  if v_it.id is null then return null; end if;
  if v_it.count > 1 then update item set count = count - 1 where id = v_it.id;
  else delete from item where id = v_it.id; end if;
  update creature set hunger = least(1, hunger + graze_fill())
    where world_id = p_world and id = p_id;
  -- And what it is worth to its learning and its care, by its quality (`beast_fed`).
  perform beast_fed(p_world, p_id, v_it.def, v_it.ql, p_care);
  return v_it.def;
end $fn$;

do $do$
declare r record; v_def text; v_n int; i int;
begin
  for r in select * from (values
    -- The brace is an artifact, and the item it uses (the browser's `ARTIFACT_FOR`).
    (1, 'artifact_item', array[$$when 'use_ancient_bridle' then 'ancient_bridle'$$],
       array[$$when 'use_ancient_bridle' then 'ancient_bridle'
                       when 'use_ancient_brace' then 'ancient_brace'$$], array[1]),
    (2, 'artifact_refusal', array[$$  if p_action = 'use_ancient_collar' and fitted(c, 'collar')$$],
       array[$$  if p_action = 'use_ancient_brace' and brace_points(c) >= brace_most() then
    return c.name || ': ' || brace_most()::int || ' ancient brace uses, the max.';
  end if;
  if p_action = 'use_ancient_collar' and fitted(c, 'collar')$$], array[1]),
    (3, 'perform_artifact', array[$$  elsif p_action in ('use_ancient_collar', 'use_ancient_bridle') then$$],
       array[$$  elsif p_action = 'use_ancient_brace' then
    -- One more use, `brace_step` more action speed, up to `brace_most`.
    v_points := brace_points(c) + 1;
    update creature set boosts = coalesce(boosts, '{}'::jsonb) || jsonb_build_object('brace', v_points)
     where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, upper(left(v_name, 1)) || substr(v_name, 2) || ' used on ' || c.name || ': action speed +'
      || whole_pct(brace_step() * v_points) || ' (' || v_points || '/' || brace_most()::int || ').', 'event');

  elsif p_action in ('use_ancient_collar', 'use_ancient_bridle') then$$], array[1]),
    -- Seed `seed_chance` of the time, on your harvest, ...
    (4, 'reap_what', array[$$  o_seeds := yld[1];$$, $$  perform gather(p_world, p_uid, cd.seed, o_seeds, o_ql);$$],
       array[$$  o_seeds := harvest_seeds(pk(p_world, p_uid, 'seed:harvest_crop', seed_chance()));$$, $$  if o_seeds > 0 then perform gather(p_world, p_uid, cd.seed, o_seeds, o_ql); end if;$$], array[1, 1]),
    -- ... a worker's in the field, ...
    (5, 'worker_do', array[$$    perform drop_on_ground(p_world, wx, wy, (select seed from crop_def where id = cr.id),
      cr.ql, null, yld[1]);$$],
       array[$$    yld[1] := harvest_seeds();
    if yld[1] > 0 then
      perform drop_on_ground(p_world, wx, wy, (select seed from crop_def where id = cr.id), cr.ql, null, yld[1]);
    end if;$$], array[1]),
    -- ... and a worker's at a planter.
    (6, 'errand_do', array[$$          perform worker_put(p_world, c, cd.seed, v_yld[1], v_ql, v_p.x, v_p.y);$$],
       array[$$          v_yld[1] := harvest_seeds();
          if v_yld[1] > 0 then perform worker_put(p_world, c, cd.seed, v_yld[1], v_ql, v_p.x, v_p.y); end if;$$], array[1]),
    -- And a tend says what the seed is.
    (7, 'perform_farm', array[$$      || ', ' || yld[1] || ' seed' || case when yld[1] > 1 then 's' else '' end || '.', 'event');$$],
       array[$$      || ', ' || seed_says() || '.', 'event');$$], array[1]),
    (8, 'perform_planter', array[$$      || ', ' || yld[1] || ' seed' || case when yld[1] > 1 then 's' else '' end || '.', 'event');$$],
       array[$$      || ', ' || seed_says() || '.', 'event');$$], array[1])
  ) as t(ord, fn, olds, news, ns) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      if v_n <> r.ns[i] then raise exception '% has % of %, not %', r.fn, v_n, r.olds[i], r.ns[i]; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
    end loop;
    execute v_def;
  end loop;
end $do$;

select private.lock_doors();
