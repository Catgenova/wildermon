/*
 * Work faster than its pace: a watch flag, `rate`, for a body whose goes of
 * gathering, crafting or looting came due faster than any go can.
 *
 * The ledger's new rows (`private.watch_made_new`) now say whose go made a
 * thing (`uid`, from `wurm.uid`, `watch_go_uid`) and when that go was due (`go_at`, from
 * `wurm.go_at`), both of which `settle` sets for the length of each go. Two
 * columns on a row the ledger writes anyway: no other write, no round trip.
 *
 * Every five minutes, before the sweep folds those rows into the day's totals
 * (`private.watch_rates`, from `watch_sweep`, and from `watch_night` before
 * its own fold): for each body and action of a kind that gathers, crafts or
 * loots (`private.origin_kind`), the goes that made something and when they
 * were due. Goes per minute is the goes after the first over the minutes
 * between the first and the last; the most there can be is 60 over the
 * shortest a go of it can take (`watch_go_floor`): `action_floor()`; for a
 * fight `action_floor() / action_pace()`; for an instant action one knock of
 * the door's pace, `1 / pace_rate('act')`. At least `watch_rate_least()`
 * goes, and more than `watch_rate_times()` times the most, is a flag, once an
 * hour a body and action.
 *
 * A body back from away whose goes all land at once is not flagged: what is
 * measured is when each go was due, not when it was settled.
 *
 * Flags only. Nothing is stopped or taken back.
 */
set local lock_timeout = '3s';

/** How many times the most goes a minute a body must go at to be flagged. */
create or replace function private.watch_rate_times() returns int language sql immutable as $fn$ select 3 $fn$;
/** The fewest goes measured before a rate is flagged. */
create or replace function private.watch_rate_least() returns int language sql immutable as $fn$ select 10 $fn$;
/** The shortest a go of this action can take, in seconds. */
create or replace function private.watch_go_floor(p_act text) returns double precision
language sql stable set search_path = public as $fn$
  select case when coalesce((select a.instant from action_def a where a.id = p_act), false)
                then 1 / private.pace_rate('act')
              when is_fight(p_act) then action_floor() / action_pace()
              else action_floor() end
$fn$;

/* Whose go is being settled, or null outside a go: `wurm.uid`, which `settle` sets. Inlines. */
create or replace function private.watch_go_uid() returns uuid
language sql stable as $fn$ select nullif(pg_catalog.current_setting('wurm.uid', true), '')::uuid $fn$;
revoke all on function private.watch_go_uid() from public, anon, authenticated;

select private.shut('alter table private.watch_made_new add column if not exists uid uuid');
select private.shut('alter table private.watch_made_new add column if not exists go_at timestamptz');

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'private.watch_items_in()'::regprocedure,
     $$  insert into private.watch_made_new (world_id, day, def, source, made_n, made_qty)
  select f.world_id, (now() at time zone 'utc')::date, f.def, private.watch_source(), count(*), sum(f.count)
$$, $$  insert into private.watch_made_new (world_id, day, def, source, made_n, made_qty, uid, go_at)
  select f.world_id, (now() at time zone 'utc')::date, f.def, private.watch_source(), count(*), sum(f.count),
         private.watch_go_uid(), private.watch_go_at()
$$),
    (2, 'private.watch_item_changed()'::regprocedure,
     $$      insert into private.watch_made_new (world_id, day, def, source, made_n, made_qty, gone_n, gone_qty)
      values (new.world_id, v_day, new.def, v_src,
              (new.count > old.count)::int, greatest(new.count - old.count, 0),
              (new.count < old.count)::int, greatest(old.count - new.count, 0));
$$, $$      insert into private.watch_made_new (world_id, day, def, source, made_n, made_qty, gone_n, gone_qty, uid, go_at)
      values (new.world_id, v_day, new.def, v_src,
              (new.count > old.count)::int, greatest(new.count - old.count, 0),
              (new.count < old.count)::int, greatest(old.count - new.count, 0),
              private.watch_go_uid(), private.watch_go_at());
$$),
    (3, 'private.watch_item_changed()'::regprocedure,
     $$      insert into private.watch_made_new (world_id, day, def, source, made_n, made_qty, gone_n, gone_qty)
      values (old.world_id, v_day, old.def, v_src, 0, 0, 1, old.count),
             (new.world_id, v_day, new.def, v_src, 1, new.count, 0, 0);
$$, $$      insert into private.watch_made_new (world_id, day, def, source, made_n, made_qty, gone_n, gone_qty, uid, go_at)
      values (old.world_id, v_day, old.def, v_src, 0, 0, 1, old.count, private.watch_go_uid(), private.watch_go_at()),
             (new.world_id, v_day, new.def, v_src, 1, new.count, 0, 0, private.watch_go_uid(), private.watch_go_at());
$$)
  ) as t(ord, fn, old, new) order by ord loop
    v_def := pg_get_functiondef(r.fn);
    continue when position(r.new in v_def) > 0;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of change %, not 1', r.fn, v_n, r.ord; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

/*
 * Each body's goes since the last fold, by action, against the most a minute
 * can hold. Reads the new rows only; the fold after it is what lets them go.
 */
create or replace function private.watch_rates() returns int
language plpgsql security definer set search_path = public as $fn$
declare r record; v_per double precision; v_most double precision; v_n int := 0;
begin
  for r in
    with g as (
      select w.world_id, w.uid, w.source, w.go_at from private.watch_made_new w
       where w.uid is not null and w.go_at is not null and w.made_n > 0 and w.source like 'act:%'
       group by w.world_id, w.uid, w.source, w.go_at),
    s as (
      select g.world_id, g.uid, g.source, count(*) as goes, extract(epoch from max(g.go_at) - min(g.go_at)) as secs
        from g group by g.world_id, g.uid, g.source
      having count(*) >= private.watch_rate_least())
    select s.world_id, s.uid, s.goes, s.secs, substr(s.source, 5) as act, private.origin_kind(s.source) as kind
      from s
  loop
    continue when r.kind not in ('gather', 'craft', 'loot');
    v_per := 60.0 * (r.goes - 1) / greatest(r.secs, 0.001);
    v_most := 60.0 / private.watch_go_floor(r.act);
    continue when v_per <= v_most * private.watch_rate_times();
    if private.watch_raise(r.world_id, r.uid, 'rate', r.uid || ':' || r.act, jsonb_build_object(
         'kind', r.kind, 'act', r.act, 'goes', r.goes, 'secs', round(r.secs::numeric, 1),
         'per_min', round(v_per::numeric, 1), 'most', round(v_most::numeric, 1),
         'times', round((v_per / v_most)::numeric, 1)), interval '1 hour') then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $fn$;

revoke all on function private.watch_rate_times(), private.watch_rate_least(), private.watch_go_floor(text),
  private.watch_rates() from public, anon, authenticated;

-- Read before each fold.
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'private.watch_sweep()'::regprocedure,
     $$  v_folded := private.watch_merge();
$$, $$  v_flags := v_flags + private.watch_rates();
  v_folded := private.watch_merge();
$$),
    (2, 'private.watch_night()'::regprocedure,
     $$  perform private.watch_merge();
  for w in select id from public.world loop
$$, $$  v_flags := v_flags + private.watch_rates();
  perform private.watch_merge();
  for w in select id from public.world loop
$$)
  ) as t(ord, fn, old, new) order by ord loop
    v_def := pg_get_functiondef(r.fn);
    continue when position(r.new in v_def) > 0;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of change %, not 1', r.fn, v_n, r.ord; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
