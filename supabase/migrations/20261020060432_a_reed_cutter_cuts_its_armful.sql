-- A reed cutter on the island cuts the armful its words promise.
--
-- Found while evening out the time to evolve: the browser cuts 1 reed and 1 more for every `REED_LEVELS` (35) levels of
-- its foraging (`finishReed`), and the Reedpup's words and the help say so; the island's `worker_do` cut 1 at any level.
-- Asked for: "Make the island match the browser (that is what the text promises)." It now cuts
-- `1 + floor(skill / reed_levels())` a cut.
--
-- The other half of the same finding went the other way, in the browser alone: a mender, a water carrier, a hod
-- carrier, a planter, a stoker and a prospector there take a go's work time as the island's errands do, a stoker and a
-- fetcher learn what the island's teach, and clearing up rot is a trade that walks out to a tile as it is here.

set local lock_timeout = '3s';

do $do$
declare v_def text;
  v_old text := $a$    return jsonb_build_object('def', 'reed', 'count', 1, 'ql', made_ql);$a$;
  v_new text := $a$    -- One reed, and one more for every `reed_levels` of its foraging (`finishReed`).
    return jsonb_build_object('def', 'reed', 'count', 1 + floor(skill / reed_levels())::int, 'ql', made_ql);$a$;
begin
  select pg_get_functiondef('public.worker_do(uuid,integer)'::regprocedure) into v_def;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'worker_do does not cut a reed where it was expected to';
  end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
