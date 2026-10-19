-- Quick Stitch, and every spell that closes the worst wound, closes the worst wound.
--
-- Asked about: "I have a deep burn that is a 94% wound and Quick Stitch keeps fixing 30% off my 3% wound".
-- `class_wounds_close` found the worst wound (`worst_wound`) and then looked for it in the list by its `id`; but a
-- wound has no id (`hurt_player` gives it none), so every wound matched, and the first in the list -- the oldest --
-- was the one closed, however light. It is found as itself now, the same whole wound `worst_wound` handed back, as a
-- dressing and a salve already find theirs.

set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text := $$(v_n = 0 and w->>'id' is not distinct from v_worst->>'id')$$;
begin
  select pg_get_functiondef('public.class_wounds_close'::regproc) into v_def;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'class_wounds_close does not match the worst wound by id once';
  end if;
  execute replace(v_def, v_old, '(v_n = 0 and w = v_worst)');
end $do$;

select private.lock_doors();
