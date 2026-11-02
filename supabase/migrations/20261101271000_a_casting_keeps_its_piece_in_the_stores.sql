-- A casting a worker takes out of a smelter keeps what it is a casting of.
--
-- Reported: "I think sluglow might have messed up my bronze castings. I can't hit them at an anvil" -- a stack of
-- "Casting (bronze)" the anvil does not offer. A smelter worker's go (a Forga's, and a Slugember's or Slugferno's
-- from `stoke_smelts_at()`) puts what a smelter made into the stores with `worker_put`, which carried the thing, the
-- count, the quality and the metal but not `piece`: a shovel head casting came out a casting of nothing, which
-- `smith_casting` (as the browser's `isCasting`) will not beat. A person taking the same output kept it (`give`).
--
--   * `worker_put` takes the piece (`p_cast`) and hands it on: to `crate_add`, which already kept it, to
--     `furniture_add` and to `drop_on_ground`, which now keep it too and stack a casting only with castings of the
--     same piece.
--   * The smelter worker's go passes each output's piece.
--
-- The browser's `intoStores` puts the whole item and was right.

set local lock_timeout = '3s';

drop function if exists furniture_add(uuid, bigint, text, integer, double precision, text);
create function furniture_add(p_world uuid, p_id bigint, p_def text, p_count integer, p_ql double precision, p_extra text,
                              p_cast text default null)
returns boolean language plpgsql as $function$
declare p placed; stacks boolean; into_id bigint;
begin
  select * into p from placed where world_id = p_world and id = p_id and kind = 'furniture';
  if not found then return false; end if;
  if furniture_refuses(p, p_def) is not null then return false; end if;
  if p_count > furniture_room(p, p_def) then return false; end if;
  select coalesce(d.stackable, false) into stacks from item_def d where d.id = p_def;
  if stacks then
    select i.id into into_id from item i
    where i.world_id = p_world and i.holder = 'furniture' and i.placed = p_id and i.def = p_def
      and i.extra is not distinct from p_extra and i.piece is not distinct from p_cast
    limit 1;
    if into_id is not null then
      update item set ql = (ql * count + p_ql * p_count) / (count + p_count), count = count + p_count
        where id = into_id;
      return true;
    end if;
  end if;
  insert into item (world_id, holder, placed, def, ql, count, extra, piece)
  values (p_world, 'furniture', p_id, p_def, greatest(0, least(100, p_ql)), p_count, p_extra, p_cast);
  return true;
end $function$;

drop function if exists drop_on_ground(uuid, integer, integer, text, double precision, text, integer);
create function drop_on_ground(p_world uuid, p_x integer, p_y integer, p_def text, p_ql double precision,
                               p_extra text default null, p_count integer default 1, p_cast text default null)
returns bigint language plpgsql as $function$
declare new_id bigint;
begin
  insert into item (world_id, holder, gx, gy, def, ql, count, extra, piece)
  values (p_world, 'ground', p_x, p_y, p_def, greatest(0, least(100, p_ql)), p_count, p_extra, p_cast)
  returning id into new_id;
  return new_id;
end $function$;

drop function if exists worker_put(uuid, creature, text, integer, double precision, integer, integer, text);
create function worker_put(p_world uuid, c creature, p_def text, p_count integer, p_ql double precision, p_x integer,
                           p_y integer, p_extra text default null, p_cast text default null)
returns void language plpgsql as $function$
declare v_at record; v_in boolean := false;
begin
  -- An errand's go being counted (`private.errand_go_made`): this put is what it made (made log).
  if coalesce(current_setting('wurm.made', true), '') <> '' then
    perform set_config('wurm.made', (current_setting('wurm.made')::jsonb || jsonb_build_array(jsonb_build_array(p_def, p_count)))::text, true);
  end if;
  for v_at in
    select 'crate'::text as kind, cr.id::bigint as id from crate cr
     where cr.world_id = p_world and cr.x = p_x and cr.y = p_y
       and crate_units(p_world, cr.id) + p_count <= crate_capacity(cr)
    union all
    select 'furniture', p.id from placed p
     where p.world_id = p_world and p.kind = 'furniture' and p.x = p_x and p.y = p_y
       and furniture_holds(p) and furniture_refuses(p, p_def) is null and p_count <= furniture_room(p, p_def)
    union all
    select w.kind, w.id from worker_store(p_world, c, p_def, p_count) w
  loop
    if v_at.kind = 'crate' then v_in := crate_add(p_world, v_at.id::int, p_def, p_count, p_ql, p_extra, p_cast);
    else v_in := furniture_add(p_world, v_at.id, p_def, p_count, p_ql, p_extra, p_cast); end if;
    if v_in and v_at.kind = 'furniture' and c.keeper is not null
       and exists (select 1 from placed b join furniture_def fd on fd.id = b.sub
                    where b.id = v_at.id and fd.takes = 'raw' and furniture_spare(b) <= 0) then
      perform journal_once(p_world, c.keeper, 'binfull');
    end if;
    if v_in then return; end if;
  end loop;
  perform drop_on_ground(p_world, p_x, p_y, p_def, p_ql, p_extra, p_count, p_cast);
end $function$;

-- The smelter worker's go: each output with its piece.
do $do$
declare v_def text; v_n int;
  v_old text := $$perform worker_put(p_world, c, v_one->>'def', (v_one->>'count')::int, (v_one->>'ql')::double precision,
                               v_p.x, v_p.y, v_one->>'extra');$$;
  v_new text := $$perform worker_put(p_world, c, v_one->>'def', (v_one->>'count')::int, (v_one->>'ql')::double precision,
                               v_p.x, v_p.y, v_one->>'extra', v_one->>'piece');$$;
begin
  v_def := pg_get_functiondef('errand_do(uuid,integer,boolean,text)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'errand_do: the smelter output put found % times, not once', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
