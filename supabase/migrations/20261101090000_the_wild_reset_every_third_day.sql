-- Every third tree rollover, every wild wildermon goes and the island restocks; and once now.
--
-- Asked: "Starting now, and every 3rd day on tree rollover, remove and respawn all untamed wildermon".
--
-- `wild_reset` takes every wild thing on an island that `wild_turnover` would take whatever its age (its `p_any`):
-- not a tamed or kept one, nor one in a fight, struck inside `blow_memory()`, trapped, in the traces, ridden, at a
-- post, under a mark, being coaxed or acted on, nor a monster. Then every stretch of country on it is owed its
-- stocking, so `stock_tick` puts the wild out again off the weights as they are now, near whoever is walking first.
-- Nothing is put out in here, as in 20261019204000: putting out the whole island in one transaction timed the world
-- clock out.
--
-- `tree_tick` runs each minute of the woods' hour (`tree_dawn_utc`). Once the island's woods are done for the day it
-- resets any island whose last reset was at a rollover `wild_reset_days()` or more ago, when it can take the creature
-- clocks' locks (`world_tick`, `stock_tick`) without waiting; one it cannot is tried again on the next minute.
-- `private.wild_reset_at` keeps the rollover each island was last reset at. Every island is reset now, and marked as
-- at the last rollover, so the next is the third rollover from here.

-- The clocks wait for this, as in 20261019204000: a round of the tick moving the same creatures in another order
-- deadlocked a reset run beside it.
set local lock_timeout = '30s';
select pg_advisory_xact_lock(hashtext('world_tick')::bigint);
select pg_advisory_xact_lock(hashtext('stock_tick')::bigint);
select pg_advisory_xact_lock(hashtext('tree_tick')::bigint);
do $$ begin lock table creature in exclusive mode; end $$;

set local lock_timeout = '3s';

create or replace function wild_reset_days() returns int language sql immutable as $fn$ select 3 $fn$;

create table if not exists private.wild_reset_at (
  world_id uuid primary key references world(id) on delete cascade,
  at timestamptz not null
);

-- Every wild thing that can go, gone, and the island owed its stocking. The number gone.
create or replace function wild_reset(p_world uuid) returns int
language plpgsql as $$
declare v_n int; v_size int;
begin
  select size into v_size from world where id = p_world;
  if v_size is null then return 0; end if;
  v_n := wild_turnover(p_world, 0, 0, v_size, v_size, true);
  update world_stocked set at = '-infinity' where world_id = p_world;
  insert into private.wild_reset_at (world_id, at) values (p_world, tree_last_dawn())
  on conflict (world_id) do update set at = excluded.at;
  return v_n;
end $$;

-- Whether an island is owed its reset at this rollover: its woods done for the day, and its last reset at a rollover
-- `wild_reset_days()` or more ago (or never).
create or replace function wild_reset_due(p_world uuid) returns boolean
language sql stable as $$
  select w.ready and w.trees_at >= tree_last_dawn()
     and coalesce((select r.at from private.wild_reset_at r where r.world_id = w.id), '-infinity')
         <= tree_last_dawn() - make_interval(days => wild_reset_days()) + interval '1 hour'
    from world w where w.id = p_world
$$;

-- One island owed its reset, when the creature clocks' locks are free now; null when none was reset.
create or replace function wild_reset_tick() returns jsonb
language plpgsql as $$
declare v_world uuid; v_n int;
begin
  select w.id into v_world from world w where wild_reset_due(w.id) order by random() limit 1;
  if v_world is null then return null; end if;
  if not pg_try_advisory_xact_lock(hashtext('world_tick')::bigint)
     or not pg_try_advisory_xact_lock(hashtext('stock_tick')::bigint) then
    return jsonb_build_object('world', v_world, 'busy', true);
  end if;
  v_n := wild_reset(v_world);
  return jsonb_build_object('world', v_world, 'gone', v_n);
end $$;

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  select pg_get_functiondef('public.tree_tick()'::regprocedure) into v_def;
  v_old := $$  perform pg_advisory_unlock(hashtext('tree_tick')::bigint);
  return jsonb_build_object('isles', case when v_world is null then 0 else 1 end, 'grew', v_grew);$$;
  v_new := $$  perform pg_advisory_unlock(hashtext('tree_tick')::bigint);
  -- And every `wild_reset_days()` rollovers, the island's wild gone and restocked (`wild_reset_tick`).
  return jsonb_build_object('isles', case when v_world is null then 0 else 1 end, 'grew', v_grew,
                            'reset', wild_reset_tick());$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'tree_tick has % of the lines to change, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

-- And now, on every island.
select w.id as world, wild_reset(w.id) as gone from world w;

select private.lock_doors();
