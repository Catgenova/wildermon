-- A creature's numbers, planned once a session rather than once a settle.
--
-- Asked for: cached derived stats. Measured on an island built like the live one (supabase/test/bench-stir.ts,
-- `track_functions = 'all'`): in a minute of rounds `stage_of` was asked 6443 times, `creature_level` 11318,
-- `trait_mul` 4651, `aura_channel` 2521, the stores' `room_for` and `mat_of` thousands of times more; and the
-- constants inside them (`evolve_at_1`, `old_at`, `rarity_room`), which a plan folds in once, were each called as
-- often as the function round them. None of these numbers is dear to work out. What was dear was planning them.
--
-- A SQL function the planner cannot fold into its caller (one that reads a table) keeps its plan only while the
-- subtransaction that made it is open. The clock settles every worker and companion in a subtransaction of its own
-- (`kept_sweep`'s `exception when lock_not_available`), so every settle planned every one of them afresh, each time it
-- was asked, and planned again whatever SQL function they asked in turn: `stage_of` planned `creature_level` twice a
-- call. Measured on that island, a settle's `stage_of`, two `beast_mul`s and an `age_row` took 1.4 ms in a
-- subtransaction each, against 0.35 ms planned once; and a round of the clock doing the same work (the same seed,
-- the budget lifted) took 28 ms a creature settled before and 24 ms after, 16% less, nothing else changed.
--
-- A PL/pgSQL function keeps its plans for the session, across subtransactions. So each of these is now PL/pgSQL,
-- returning exactly the one query it was (`return (<the query>)`): the same answer, the same tables read, planned
-- once. Every one answers a single row (a key, an aggregate, `limit 1`), so a query that was a function's whole body
-- reads the same as a scalar subquery. A function that answers a row of a table answers it as the row
-- (`return (select cw_row from <table> cw_row ...)`): null when there is none, as before.
--
-- supabase/test/writeload.ts puts each back as the SQL it was and finds every answer the same, for every creature,
-- stage, trait, gear and channel on its island and every piece of furniture and thing, and a round of the clock and
-- an hour of work the same island both ways.
--
-- Only functions that read a table are changed: one the planner folds into its caller (`beast_mul`, `evo_mul`,
-- `max_health`, `worker_pace`, `tire_of`) is left as SQL, which is the cheapest it can be.

set local lock_timeout = '3s';

do $do$
declare r record; v_def text; v_body text; v_old text; v_new text; v_n int; v_row text;
begin
  for r in
    select p.oid, p.oid::regprocedure::text as sig, l.lanname, p.prosrc, p.prosqlbody is not null as atomic, t.typtype
      from pg_proc p join pg_language l on l.oid = p.prolang join pg_type t on t.oid = p.prorettype
     where p.oid = any (array[
       -- A creature's numbers.
       'public.stage_of(creature)', 'public.creature_level(jsonb)', 'public.trait_mul(text[], text)',
       'public.aura_channel(text)', 'public.deed_aura_of(uuid, uuid, bigint, text)', 'public.evo_perk(creature, text)',
       'public.perk_n(creature, text)', 'public.task_skill(creature)', 'public.work_range(creature)',
       'public.den_class(creature)', 'public.learn_pace(creature, text)', 'public.species_health(text)',
       'public.class_mul(uuid, uuid, text, text)', 'public.rarity_blood(text, text)', 'public.companion_quick(creature)',
       'public.kind_name_at(creature)', 'public.kind_named(creature)', 'public.deed_trade_workers(uuid, uuid, text)',
       'public.stun_left(uuid, integer)', 'public.world_time(uuid)', 'public.work_stats_time(jsonb, double precision, text)',
       'public.age_row(timestamp with time zone, double precision)',
       'public.age_row(timestamp with time zone, double precision, double precision)',
       'public.deed_of(uuid, uuid)',
       -- What the stores hold and take, asked on every errand.
       'public.room_for(double precision, text)', 'public.mat_of(text)', 'public.furniture_capacity(placed)',
       'public.furniture_heft(placed)', 'public.liquid_capacity(placed)', 'public.furniture_refuses(placed, text)',
       'public.furniture_takes(text, text)', 'public.item_raw(text)', 'public.item_worked(text)',
       'public.furniture_units(placed)', 'public.crate_units(uuid, integer)', 'public.crate_capacity(crate)',
       'public.furniture_kg(placed)', 'public.item_kg(text)', 'public.store_markable_refusal(placed)',
       'public.store_reached(uuid, text, bigint)', 'public.storey_reached(uuid, integer, integer, integer)'
     ]::regprocedure[])
  loop
    if r.lanname <> 'sql' or r.atomic then raise exception '% is not a SQL function with a body to wrap', r.sig; end if;
    v_body := btrim(r.prosrc, E' \t\r\n');
    v_body := btrim(rtrim(v_body, ';'), E' \t\r\n');
    -- One statement: no `;` once its quoted words and its comments are taken out.
    if v_body !~* '^select\s'
       or position(';' in regexp_replace(regexp_replace(v_body, '''([^'']|'''')*''', '', 'g'), '--[^\n]*', '', 'g')) > 0 then
      raise exception '% is not one select: %', r.sig, left(v_body, 200);
    end if;
    if r.typtype = 'c' then
      -- A row of a table: `select * from <table or function>[ where ... | limit ...]`, answered as the row itself.
      v_row := (regexp_match(v_body, '^select \* from ([a-z_]+(\([a-z_, ]*\))?)( (where|limit) .*)?$'))[1];
      if v_row is null then raise exception '% answers a row in a shape this does not know: %', r.sig, v_body; end if;
      v_body := 'select cw_row from ' || v_row || ' cw_row' || substr(v_body, length('select * from ' || v_row) + 1);
    end if;
    v_def := pg_get_functiondef(r.oid);
    v_old := 'AS $function$' || r.prosrc || '$function$';
    v_new := E'AS $function$\nbegin\n  return (\n' || v_body || E'\n  );\nend $function$';
    v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_n <> 1 then raise exception '%: % bodies to change, not 1', r.sig, v_n; end if;
    v_def := replace(v_def, v_old, v_new);
    v_n := (length(v_def) - length(replace(v_def, E'\n LANGUAGE sql\n', ''))) / length(E'\n LANGUAGE sql\n');
    if v_n <> 1 then raise exception '%: % languages to change, not 1', r.sig, v_n; end if;
    execute replace(v_def, E'\n LANGUAGE sql\n', E'\n LANGUAGE plpgsql\n');
  end loop;
end $do$;

select private.lock_doors();
