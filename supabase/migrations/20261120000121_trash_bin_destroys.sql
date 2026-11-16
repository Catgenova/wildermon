/*
 * A trash crate destroys what is put in it.
 *
 * Asked for: "Trash bins should decay anything placed in them quickly. 3 hours at 1ql 30m at 100ql". The browser rotted
 * what was in an unnamed trash crate thirty times faster than the rain (`Game.runPlaceables`); the island never did, so
 * a trash crate on the island filled up and stayed full. Now each stack in one is destroyed whole once it has been in
 * it `trash_span(ql)` seconds, the crate's own QL: `trash_secs_at_1()` at QL 1 down to `trash_secs_at_100()` at QL 100,
 * linear between (`src/game/trash.ts`). A trash crate named for an item, a Chestkit target, the same (was: kept).
 *
 *   * `item.binned_at`: when the stack went into the trash crate that holds it; null for everything else. Set by a
 *     trigger, so every road in starts the clock: a put, Trash, a worker's move into a named one, a split put back.
 *     A stack put onto one already in the crate (`move_part`'s merge) goes with that one. Taken out, it is cleared;
 *   * `trash_sweep`: on the world clock with the other sweeps (`world_tick`), off a partial index of the stacks in
 *     trash crates and nothing else;
 *   * what is in a trash crate now is timed from this migration.
 *
 * `trash_secs_at_1` and `trash_secs_at_100` are the definitions' (`scripts/dump-defs.ts`, migration 123); they are set
 * here as well, to the same numbers, so the sweep has them from the moment it is on the clock.
 */
set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

-- The two ends, as the definitions have them (`TRASH_SECS_AT_1`, `TRASH_SECS_AT_100`).
create or replace function trash_secs_at_1() returns double precision language sql immutable as $fn$ select 10800::double precision $fn$;
create or replace function trash_secs_at_100() returns double precision language sql immutable as $fn$ select 1800::double precision $fn$;

-- Seconds a stack lasts in a trash crate of this QL, QL held to 1..100 (`trashSpan`).
create or replace function trash_span(p_ql double precision) returns double precision
language sql immutable as $$
  select trash_secs_at_1() - (least(100, greatest(1, coalesce(p_ql, 1))) - 1) * (trash_secs_at_1() - trash_secs_at_100()) / 99
$$;

select private.shut('alter table public.item add column if not exists binned_at timestamptz');

-- The stacks in trash crates, and nothing else: what the sweep reads.
select private.shut('create index if not exists item_binned on public.item (world_id, binned_at) where binned_at is not null');

/*
 * When a stack went into the trash crate that holds it. Into one, from anywhere else or from another one: now. Kept
 * while it stays in the same one. Anywhere but a trash crate: null.
 */
create or replace function trash_binned_trigger() returns trigger
language plpgsql as $$
begin
  if new.holder = 'furniture' and new.placed is not null
     and exists (select 1 from placed p join furniture_def fd on fd.id = p.sub
                  where p.id = new.placed and coalesce(fd.trash, 0) > 0) then
    if tg_op = 'INSERT' then
      new.binned_at := coalesce(new.binned_at, now());
    elsif old.holder is distinct from 'furniture' or old.placed is distinct from new.placed or old.binned_at is null then
      new.binned_at := now();
    end if;
  else
    new.binned_at := null;
  end if;
  return new;
end $$;

select private.shut('drop trigger if exists trash_binned_in on public.item');
select private.shut($ddl$create trigger trash_binned_in before insert on public.item
  for each row when (new.holder = 'furniture') execute function public.trash_binned_trigger()$ddl$);
select private.shut('drop trigger if exists trash_binned_moved on public.item');
select private.shut($ddl$create trigger trash_binned_moved before update of holder, placed on public.item
  for each row when (new.holder = 'furniture' or old.binned_at is not null) execute function public.trash_binned_trigger()$ddl$);

-- What is in a trash crate now: timed from here.
update item i set binned_at = now()
  from placed p join furniture_def fd on fd.id = p.sub
 where i.holder = 'furniture' and i.placed = p.id and coalesce(fd.trash, 0) > 0 and i.binned_at is null;

-- Every stack in a trash crate of this island whose time by the crate's QL is up, gone whole (what is in a bag goes with it).
create or replace function trash_sweep(p_world uuid) returns integer
language plpgsql as $$
declare v_n int;
begin
  delete from item i using placed p
   where i.world_id = p_world and i.binned_at is not null
     and i.binned_at <= now() - make_interval(secs => trash_secs_at_100())
     and p.id = i.placed
     and i.binned_at <= now() - make_interval(secs => trash_span(p.ql));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- On the clock, with what rots on the ground and the stations.
select pg_temp.patch_fn('public.world_tick()'::regprocedure,
  $o$      v_rotted := v_rotted + ground_sweep(w.id) + station_sweep(w.id);$o$,
  $n$      v_rotted := v_rotted + ground_sweep(w.id) + station_sweep(w.id);
      -- And what has been in a trash crate its time (`trash_sweep`).
      v_rotted := v_rotted + trash_sweep(w.id);$n$);

select private.lock_doors();
