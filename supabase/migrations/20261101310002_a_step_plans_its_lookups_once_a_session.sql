-- The small lookups a step asks, planned once a session rather than once a step.
--
-- A SQL function that cannot be inlined -- one with a FROM or a sub-select in it, which is every lookup below -- has
-- its body planned again every time a statement that calls it starts, and inside a plpgsql function every query is
-- such a statement. `rpc_move` asks `path_fx` from six places, `land_height` from eight, `worn_enchant` from three,
-- and so on through thirty of them; each place paid for planning its lookup on every step, a tenth to a third
-- of a millisecond apiece, which came to more of the step than the lookups themselves. A plpgsql function keeps its
-- plans for the life of the connection.
--
-- So each of these becomes a plpgsql function returning exactly what its SQL body selects:
--   * the body is the same text, read from the function as it stands, and returned as one value;
--   * a name that is both a column and an argument means the column, as it did in SQL (`#variable_conflict
--     use_column`);
--   * every one of them selects one row or none -- a lookup by key, an aggregate, an `exists`, or no FROM at all --
--     so returning it as one value is the SQL function's answer, NULL where it found nothing;
--   * its arguments, its result, how volatile it is and everything else on it stay as they were.
-- None of them could be inlined before, so nothing that inlined one loses it.
--
-- The same answer from each, for everything; a step takes less time, and so does everything else that asks them.

set local lock_timeout = '3s';

do $do$
declare r record; v_src text; v_def text; v_new text; n int := 0;
begin
  for r in
    select p.oid, p.proname, p.prosrc
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.oid in ('public.path_fx(uuid, uuid, text, double precision)'::regprocedure,
                     'public.pk(uuid, uuid, text, double precision)'::regprocedure,
                     'public.worn_enchant(uuid, uuid, text)'::regprocedure,
                     'public.bags_carry(uuid, uuid)'::regprocedure,
                     'public.carry_limit(uuid, uuid)'::regprocedure,
                     'public.over_carry(uuid, uuid)'::regprocedure,
                     'public.land_height(uuid, integer, integer)'::regprocedure,
                     'public.in_deep_water(uuid, uuid)'::regprocedure,
                     'public.skill_standing(uuid, uuid, text)'::regprocedure,
                     'public.region_at(uuid, double precision, double precision)'::regprocedure,
                     'public.spiral_at(uuid, integer, integer, integer)'::regprocedure,
                     'public.water_bed(uuid, integer, integer)'::regprocedure,
                     'public.water_surface(uuid, integer, integer)'::regprocedure,
                     'public.runestone_near(integer, double precision, double precision, double precision, double precision)'::regprocedure,
                     'public.darkness(uuid)'::regprocedure,
                     'public.aware_dark(uuid, uuid)'::regprocedure,
                     'public.chunk_slope(land_chunk, integer, integer, integer, integer, integer)'::regprocedure,
                     'public.walk_length(double precision[], double precision[])'::regprocedure,
                     'public.walk_tiles(double precision[], double precision[])'::regprocedure,
                     'public.nutrition_fedness(jsonb)'::regprocedure,
                     'public.stage_of(creature)'::regprocedure,
                     'public.placed_enchant(placed, text)'::regprocedure,
                     'public.is_boat(placed)'::regprocedure,
                     -- And what a go of a skill asks, which a step pays for a tile walked in the dark or up a slope.
                     'public.nutrition_balance(jsonb)'::regprocedure,
                     'public.jewel_gain(item, text)'::regprocedure,
                     'public.stones_of(item)'::regprocedure,
                     'public.world_time(uuid)'::regprocedure)
  loop
    if (select l.lanname from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = r.oid) <> 'sql' then
      raise exception '% is no longer a SQL function; look at it again before planning it once', r.proname;
    end if;
    -- One statement: the body with its last semicolon taken off has none left in it, past its comments and strings.
    v_src := regexp_replace(r.prosrc, '[\s;]+$', '');
    if position(';' in regexp_replace(regexp_replace(regexp_replace(v_src, '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g'), '''[^'']*''', '', 'g')) > 0
       or position('$function$' in v_src) > 0 then
      raise exception '% is more than one statement; it cannot be returned as one value', r.proname;
    end if;
    v_def := pg_get_functiondef(r.oid);
    v_new := replace(v_def, E'\n LANGUAGE sql\n', E'\n LANGUAGE plpgsql\n');
    if v_new = v_def then raise exception '% did not say LANGUAGE sql where it was looked for', r.proname; end if;
    -- The newline before the closing bracket: a body that ends in a comment would otherwise comment it out.
    v_def := replace(v_new, '$function$' || r.prosrc || '$function$',
                     E'$function$\n#variable_conflict use_column\nbegin\n  return (\n' || v_src || E'\n  );\nend\n$function$');
    if v_def = v_new then raise exception '% did not have its body where it was looked for', r.proname; end if;
    execute v_def;
    n := n + 1;
  end loop;
  if n <> 27 then raise exception 'planned % of the twenty-seven lookups once; wanted all of them', n; end if;
end $do$;

-- And the three that hand back a whole row, which a step asks several times each: the row, or NULL where there is
-- none, as the SQL function answered (not a row of NULLs).

/** The vehicle or hull this body has the reins or the helm of, if any. */
create or replace function driving(p_world uuid, p_uid uuid) returns placed language plpgsql stable as $fn$
declare r placed;
begin
  select p.* into r from placed p where p.world_id = p_world and p.driver = p_uid limit 1;
  if not found then return null; end if;
  return r;
end $fn$;

/** The creature this body is riding, if any. */
create or replace function mount_of(p_world uuid, p_uid uuid) returns creature language plpgsql stable as $fn$
declare r creature;
begin
  select c.* into r from creature c where c.world_id = p_world and c.rider = p_uid limit 1;
  if not found then return null; end if;
  return r;
end $fn$;

/** The thing a body wears in a slot, if any. */
create or replace function worn(p_world uuid, p_uid uuid, p_slot text) returns item language plpgsql stable as $fn$
#variable_conflict use_column
declare r item;
begin
  select i.* into r from player p
  join item i on i.id = (p.equipped->>p_slot)::bigint
    and i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
  where p.world_id = p_world and p.uid = p_uid;
  if not found then return null; end if;
  return r;
end $fn$;

select private.lock_doors();
