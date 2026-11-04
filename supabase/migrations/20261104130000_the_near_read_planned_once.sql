-- The near read planned once, and its creatures' sums worked out once each.
--
-- Audited on a copy of the test island given an island's worth of rows (7,700 creatures, 150 deeds with crops, walls,
-- floors, foundations, crates and stores, 150 load-test bodies on empty land as `tools/loadtest.ts` puts them) and one
-- developed settlement round a measured body: its deed and four members, four buildings of three storeys, crates and
-- chests, crops, and forty of its own (thirty workers, ten at heel). What every browser asks once a second, the
-- changes-only `rpc_near`, each call its own transaction on a warm connection, as PostgREST asks it. Each change below
-- gives the same answer, row for row.
--
--   * `crates_near` (the ground's fast half, every second) was a SQL function that cannot be inlined, so its query was
--     parsed and planned again on every call: about 1 ms of a 3 ms call on empty land. The same query in plpgsql keeps
--     its plan: 0.13 ms. `deed_trade_counts` (a worker's `specialty`, read whenever one of your own is sent) the same:
--     1.4 ms to 0.3 ms. `since_text` (each half's cursor) the same, 0.15 ms to 0.04 ms, twice a call.
--   * The cursors were read with `regexp_match` on a pattern of bounded repeats with captures, 0.15 to 0.2 ms a match,
--     three a call. The same pattern asked as a yes or no is 0.01 ms; once it says yes, the fields are exactly the
--     pieces between the colons.
--   * `rpc_ground` built its answer as one expression, the fast half `||` `case when not p_slow then '{}' else` the
--     slow half. A plan kept for every value of `p_slow` is costed with every subquery of the slow half in it, so the
--     planner made a fresh one on each call, fast or whole. Two statements now, the slow half added when `p_slow` is
--     not false (as the case had it: a null `p_slow` was the slow half too): 0.4 ms off each fast call, and the slow
--     half's plan kept for the whole answer.
--   * And what a creature's row costs (`max_health` on every row sent, 0.24 ms of it a row): `stage_of` named its
--     `creature_level` twice through a subquery the planner folds in, and `creature_level` its `level_skill` the same
--     way, so each was worked out twice, four `level_skill` a creature; each once now (`offset 0`). `class_mul` handed a
--     subquery to the SQL `class_mul` it calls, which therefore could not be inlined and was set up again on every call;
--     the keeper's row is read on its own now and the rule inlines. Each is still the one query it returns. And `trait_effect` had no index, so `trait_mul` and
--     `aura_channel` read all of it on every call: by its channel now. `max_health`: 0.24 ms to 0.075 ms a creature.
--     These are the rules' own functions, so the clock gains it too.
--
-- The per-second read, on empty land 3.3 ms to 1.6 ms a call; at the settlement 17.3 ms to 11.5 ms. The whole answer
-- (once a minute and after anything you do) 7.4 ms to 5.5 ms on empty land, 64-73 ms to 57-61 ms at the settlement.
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

-- Several edits to one function made as one, for edits that are not valid one at a time: each must be found once.
create or replace function pg_temp.patch_fn_all(p_sig regprocedure, p_old text[], p_new text[]) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  for i in 1 .. cardinality(p_old) loop
    v_n := (length(v_def) - length(replace(v_def, p_old[i], ''))) / length(p_old[i]);
    if v_n <> 1 then
      raise exception '%: % of "%", wanted 1', p_sig, v_n, left(p_old[i], 120);
    end if;
    v_def := replace(v_def, p_old[i], p_new[i]);
  end loop;
  execute v_def;
end $p$;

-- ---- planned once: the same queries in plpgsql ----------------------------------------------------------------

select pg_temp.patch_fn_all('public.crates_near(uuid,uuid,double precision)'::regprocedure,
  array[$o$ LANGUAGE sql
 STABLE
AS $function$
$o$,
        $o$    from player p, may where p.world_id = p_world and p.uid = p_uid
$function$$o$],
  array[$n$ LANGUAGE plpgsql
 STABLE
AS $function$
begin
  return (
$n$,
        $n$    from player p, may where p.world_id = p_world and p.uid = p_uid
  );
end $function$$n$]);

select pg_temp.patch_fn_all('public.deed_trade_counts(uuid,uuid)'::regprocedure,
  array[$o$ LANGUAGE sql
 STABLE
AS $function$
$o$,
        $o$           group by 1) t
$function$$o$],
  array[$n$ LANGUAGE plpgsql
 STABLE
AS $function$
begin
  return (
$n$,
        $n$           group by 1) t
  );
end $function$$n$]);

create or replace function private.since_text(p_snap pg_snapshot) returns text language plpgsql as $function$
begin
  return (
select case when pg_current_xact_id_if_assigned() is null then p_snap::text
              else least(pg_snapshot_xmin(p_snap), pg_current_xact_id_if_assigned())::text || ':' || pg_snapshot_xmax(p_snap)::text || ':'
                   || (select string_agg(x::text, ',' order by x)
                         from (select pg_snapshot_xip(p_snap) as x union select pg_current_xact_id_if_assigned()) q) end
  );
end $function$;

-- ---- the cursors read as a yes or no, then cut at the colons --------------------------------------------------

select pg_temp.patch_fn('private.since_snap(text)'::regprocedure,
  $o$  m := regexp_match(p_since, '^v1:([0-9]{1,15}):([0-9]{1,19}):([0-9]{1,19}):([0-9]{1,19}(,[0-9]{1,19})*)?$');
  if m is null then return null; end if;$o$,
  $n$  -- The same pattern as a yes or no, a tenth of the cost of its captures: the fields are the pieces between the colons.
  if p_since !~ '^v1:[0-9]{1,15}:[0-9]{1,19}:[0-9]{1,19}:([0-9]{1,19}(,[0-9]{1,19})*)?$' then return null; end if;
  m := (string_to_array(p_since, ':'))[2:4] || nullif(split_part(p_since, ':', 5), '');$n$);

select pg_temp.patch_fn('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure,
  $o$    m := regexp_match(p_since, '^g1:(-?[0-9.]+(?:e[-+]?[0-9]+)?):(-?[0-9.]+(?:e[-+]?[0-9]+)?):([0-9.]+(?:e[-+]?[0-9]+)?):([0-9]{1,9}):(v1:.*)$');$o$,
  $n$    -- The same pattern as a yes or no; then the four fields between the first colons, and the `v1` cursor after them.
    m := case when p_since ~ '^g1:-?[0-9.]+(?:e[-+]?[0-9]+)?:-?[0-9.]+(?:e[-+]?[0-9]+)?:[0-9.]+(?:e[-+]?[0-9]+)?:[0-9]{1,9}:v1:'
               then (string_to_array(p_since, ':'))[2:5] || array_to_string((string_to_array(p_since, ':'))[6:], ':') end;$n$);

-- ---- the ground's two halves, two statements ------------------------------------------------------------------

select pg_temp.patch_fn_all('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure,
  array[$o$  || case when not p_slow then '{}'::jsonb else jsonb_build_object($o$,
        $o$        and gs.y between floor(p.y - p_range)::int and floor(p.y + p_range)::int), '[]'::jsonb)) end;$o$],
  array[$n$  ;
  -- (Its own statement: one plan kept for both halves was costed with all of this in it, and so made again each call.)
  if p_slow is not false then v_out := v_out || jsonb_build_object($n$,
        $n$        and gs.y between floor(p.y - p_range)::int and floor(p.y + p_range)::int), '[]'::jsonb));
  end if;$n$]);

-- ---- a creature's sums, each worked out once ------------------------------------------------------------------

-- Each a single query returned, as 20261101350001 made them (supabase/test/writeload.ts puts them back as that SQL):
-- `offset 0` keeps the subquery a row of its own, so what it names is worked out once however often it is read.
select pg_temp.patch_fn('public.stage_of(creature)'::regprocedure,
  $o$from (select creature_level(c.skills, c.species) as v) l)$o$,
  $n$from (select creature_level(c.skills, c.species) as v offset 0) l)$n$);

select pg_temp.patch_fn('public.creature_level(jsonb,text)'::regprocedure,
  $o$    from (select level_skill(p_species) as skill) ls$o$,
  $n$    from (select level_skill(p_species) as skill offset 0) ls$n$);

-- The keeper's row read on its own, so the rule is handed a column rather than a subquery and inlines.
select pg_temp.patch_fn('public.class_mul(uuid,uuid,text,text)'::regprocedure,
  $o$select class_mul(coalesce((select pl.class_mul from player pl
                              where pl.world_id = p_world and pl.uid = p_uid), '{}'::jsonb),
                   p_channel, p_skill)$o$,
  $n$select class_mul(coalesce(q.m, '{}'::jsonb), p_channel, p_skill)
  from (select (select pl.class_mul from player pl where pl.world_id = p_world and pl.uid = p_uid) as m offset 0) q$n$);

create index if not exists trait_effect_by_channel on public.trait_effect (channel, trait);

select private.lock_doors();
